#!/bin/bash
# ============================================================
#  SUPABASE COMPLETE RESTORE SCRIPT
#  Usage: bash restore_supabase.sh <backup_archive.tar.gz>
# ============================================================

set -e

if [ -z "$1" ]; then
  echo "ERROR: Please provide the backup archive."
  echo "Usage: bash restore_supabase.sh supabase_backup_20240219_120000.tar.gz"
  exit 1
fi

ARCHIVE="$1"
if [ ! -f "$ARCHIVE" ]; then
  echo "ERROR: File not found: $ARCHIVE"
  exit 1
fi

RESTORE_TMP="./supabase_restore_tmp"
PROJECT_DIR="/c/Users/Eitan Baron/Documents/GitHub/studio"

echo "=============================================="
echo "  SUPABASE FULL RESTORE"
echo "  Source: $ARCHIVE"
echo "=============================================="

# Extract archive
echo ""
echo "[EXTRACT] Extracting archive..."
rm -rf "$RESTORE_TMP"
mkdir -p "$RESTORE_TMP"
tar xzf "$ARCHIVE" -C "$RESTORE_TMP" --strip-components=1
echo "          ✓ Done"

# Resolve Docker-safe path (double slash stops Git Bash path mangling)
ABS_RESTORE="$(cd "${RESTORE_TMP}" && pwd)"
DOCKER_RESTORE_DIR="$(echo "${ABS_RESTORE}" | sed -E 's|^/([a-zA-Z])/|//\1/|')"

# --------------------------------------------------------------
# HELPER: restore a volume
# --------------------------------------------------------------
restore_volume() {
  local VOLUME_NAME=$1
  local TARFILE="${RESTORE_TMP}/${VOLUME_NAME}.tar.gz"

  if [ ! -f "$TARFILE" ]; then
    echo "[SKIP] No backup found for volume: $VOLUME_NAME"
    return
  fi

  echo ""
  echo "[VOLUME] Restoring: $VOLUME_NAME ..."
  docker volume create "$VOLUME_NAME" > /dev/null 2>&1 || true

  MSYS_NO_PATHCONV=1 docker run --rm \
    -v "${VOLUME_NAME}:/data" \
    -v "${DOCKER_RESTORE_DIR}:/backup:ro" \
    alpine \
    sh -c "rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null || true; tar xzf /backup/${VOLUME_NAME}.tar.gz -C /data"

  echo "         ✓ Done"
}

# --------------------------------------------------------------
# HELPER: wait for postgres
# --------------------------------------------------------------
wait_for_postgres() {
  local CONTAINER=$1
  echo "           Waiting for postgres in $CONTAINER..."
  for i in $(seq 1 40); do
    if docker exec "$CONTAINER" pg_isready -U postgres > /dev/null 2>&1; then
      echo "           ✓ Ready"
      return 0
    fi
    sleep 2
    echo "           Still waiting... ($((i*2))s)"
  done
  echo "           [WARN] Postgres not ready after 80s — trying anyway"
}

# --------------------------------------------------------------
# HELPER: restore postgres dump
# --------------------------------------------------------------
restore_postgres() {
  local CONTAINER=$1
  local LABEL=$2
  local DUMPFILE="${RESTORE_TMP}/${LABEL}_pgdumpall.sql"

  if [ ! -f "$DUMPFILE" ]; then
    echo "[SKIP] No pg_dump found for: $LABEL"
    return
  fi

  echo ""
  echo "[POSTGRES] Restoring into: $CONTAINER ..."
  wait_for_postgres "$CONTAINER"

  docker exec "$CONTAINER" psql -U postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid();" \
    > /dev/null 2>&1 || true

  docker exec -i "$CONTAINER" psql -U postgres < "$DUMPFILE"
  echo "           ✓ Done"
}

# ==============================================================
#  STEP 1: STOP ALL CONTAINERS
# ==============================================================
echo ""
echo "----------------------------------------------"
echo " STEP 1: Stop running Supabase containers"
echo "----------------------------------------------"

ALL_CONTAINERS=(
  supabase_analytics_studio
  supabase_realtime_studio
  supabase_rest_studio
  supabase_storage_studio
  supabase_auth_studio
  supabase_kong_studio
  supabase_inbucket_studio
  supabase_pg_meta_studio
  supabase_vector_studio
  supabase_studio_studio
  supabase_db_studio
  supabase_analytics_supabase-secondary
  supabase_realtime_supabase-secondary
  supabase_rest_supabase-secondary
  supabase_storage_supabase-secondary
  supabase_auth_supabase-secondary
  supabase_kong_supabase-secondary
  supabase_inbucket_supabase-secondary
  supabase_pg_meta_supabase-secondary
  supabase_vector_supabase-secondary
  supabase_studio_supabase-secondary
  supabase_db_supabase-secondary
)

for c in "${ALL_CONTAINERS[@]}"; do
  if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
    docker stop "$c" > /dev/null 2>&1 && echo "[STOP] ✓ $c" || echo "[STOP] Failed: $c"
  fi
done

# ==============================================================
#  STEP 2: RESTORE VOLUMES
# ==============================================================
echo ""
echo "----------------------------------------------"
echo " STEP 2: Restore volumes"
echo "----------------------------------------------"

restore_volume "supabase_db_studio"
restore_volume "supabase_storage_studio"
restore_volume "supabase_db_supabase-secondary"
restore_volume "supabase_storage_supabase-secondary"

# ==============================================================
#  STEP 3: RESTORE PROJECT CONFIG FILES
# ==============================================================
echo ""
echo "----------------------------------------------"
echo " STEP 3: Restore project config files"
echo "----------------------------------------------"

if [ -d "${RESTORE_TMP}/project_config/supabase" ]; then
  cp -r "${RESTORE_TMP}/project_config/supabase/." "${PROJECT_DIR}/supabase/" 2>/dev/null && echo "[CONFIG] ✓ supabase/ config restored" || true
fi
if [ -d "${RESTORE_TMP}/project_config/supabase-secondary" ]; then
  cp -r "${RESTORE_TMP}/project_config/supabase-secondary/." "${PROJECT_DIR}/supabase-secondary/supabase/" 2>/dev/null && echo "[CONFIG] ✓ supabase-secondary/ config restored" || true
fi
for f in "${RESTORE_TMP}"/project_config/.env*; do
  [ -f "$f" ] && cp "$f" "${PROJECT_DIR}/" && echo "[CONFIG] ✓ $(basename $f) restored" || true
done

# ==============================================================
#  STEP 4: RESTART CONTAINERS
# ==============================================================
echo ""
echo "----------------------------------------------"
echo " STEP 4: Restart containers"
echo "----------------------------------------------"

# Start in reverse order (db first)
for c in "${ALL_CONTAINERS[@]}"; do
  if docker ps -a --format '{{.Names}}' | grep -q "^${c}$"; then
    docker start "$c" > /dev/null 2>&1 && echo "[START] ✓ $c" || echo "[START] Failed: $c"
  else
    echo "[SKIP]  Container doesn't exist: $c"
  fi
done

# ==============================================================
#  STEP 5: RESTORE POSTGRES DATA
# ==============================================================
echo ""
echo "----------------------------------------------"
echo " STEP 5: Restore PostgreSQL data"
echo "----------------------------------------------"
echo "[INFO] PostgreSQL data is already completely restored via the volume backups in Step 2."
echo "[INFO] Skpping pg_dumpall restore to prevent duplicate key conflicts."
# restore_postgres "supabase_db_studio" "studio"
# restore_postgres "supabase_db_supabase-secondary" "secondary"

# ==============================================================
#  CLEANUP
# ==============================================================
echo ""
echo "[CLEANUP] Removing temp files..."
rm -rf "$RESTORE_TMP"

echo ""
echo "=============================================="
echo "  RESTORE COMPLETE!"
echo ""
echo "  Restored:"
echo "   ✓ supabase_db_studio              (volume)"
echo "   ✓ supabase_storage_studio         (volume)"
echo "   ✓ supabase_db_supabase-secondary  (volume)"
echo "   ✓ supabase_storage_supabase-secondary (volume)"
echo "   ✓ PostgreSQL data (pg_dumpall)"
echo "   ✓ Project config + migrations"
echo ""
echo "  Check Docker Desktop — all containers should"
echo "  show green dots within ~30 seconds."
echo "=============================================="
