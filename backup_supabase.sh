#!/bin/bash
# ============================================================
#  SUPABASE COMPLETE BACKUP SCRIPT
#  Tailored for: studio + supabase-secondary stacks
#  Run from Git Bash: bash backup_supabase.sh
# ============================================================

set -e

BACKUP_DIR="supabase_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

# Resolve absolute path and convert for Docker on Windows Git Bash
# e.g. /c/Users/... → //c/Users/... (double slash stops Git Bash path mangling)
ABS_DIR="$(cd "${BACKUP_DIR}" && pwd)"
DOCKER_BACKUP_DIR="$(echo "${ABS_DIR}" | sed -E 's|^/([a-zA-Z])/|//\1/|')"

echo "=============================================="
echo "  SUPABASE FULL BACKUP"
echo "  Destination: $BACKUP_DIR"
echo "=============================================="

# --------------------------------------------------------------
# HELPER: backup a named volume
# --------------------------------------------------------------
backup_volume() {
  local VOLUME_NAME=$1
  echo ""
  echo "[VOLUME] Backing up: $VOLUME_NAME ..."
  MSYS_NO_PATHCONV=1 docker run --rm \
    -v "${VOLUME_NAME}:/data:ro" \
    -v "${DOCKER_BACKUP_DIR}:/backup" \
    alpine \
    tar czf "/backup/${VOLUME_NAME}.tar.gz" -C /data .
  echo "         ✓ Done"
}

# --------------------------------------------------------------
# HELPER: pg_dumpall from a postgres container
# --------------------------------------------------------------
backup_postgres() {
  local CONTAINER=$1
  local LABEL=$2
  echo ""
  echo "[POSTGRES] Dumping: $CONTAINER ..."
  docker exec -t "$CONTAINER" pg_dumpall -U postgres > "${BACKUP_DIR}/${LABEL}_pgdumpall.sql"
  echo "           ✓ Done"
}

# --------------------------------------------------------------
# HELPER: save full container config
# --------------------------------------------------------------
backup_container_config() {
  local CONTAINER=$1
  docker inspect "$CONTAINER" > "${BACKUP_DIR}/inspect_${CONTAINER}.json"
}

# ==============================================================
#  STEP 1: CONTAINER CONFIGS
# ==============================================================
echo ""
echo "----------------------------------------------"
echo " STEP 1: Save container configs"
echo "----------------------------------------------"

ALL_CONTAINERS=(
  supabase_db_studio
  supabase_studio_studio
  supabase_pg_meta_studio
  supabase_storage_studio
  supabase_rest_studio
  supabase_realtime_studio
  supabase_inbucket_studio
  supabase_auth_studio
  supabase_kong_studio
  supabase_vector_studio
  supabase_analytics_studio
  supabase_db_supabase-secondary
  supabase_studio_supabase-secondary
  supabase_pg_meta_supabase-secondary
  supabase_storage_supabase-secondary
  supabase_rest_supabase-secondary
  supabase_realtime_supabase-secondary
  supabase_inbucket_supabase-secondary
  supabase_auth_supabase-secondary
  supabase_kong_supabase-secondary
  supabase_vector_supabase-secondary
  supabase_analytics_supabase-secondary
)

for c in "${ALL_CONTAINERS[@]}"; do
  if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
    backup_container_config "$c"
    echo "[CONFIG] ✓ $c"
  else
    echo "[SKIP]   Not running: $c"
  fi
done

echo ""
echo "[NETWORK] Saving network configs..."
docker network inspect supabase_network_studio > "${BACKUP_DIR}/network_studio.json" 2>/dev/null && echo "          ✓ studio network" || echo "          - studio network not found"
docker network inspect "supabase_network_supabase-secondary" > "${BACKUP_DIR}/network_secondary.json" 2>/dev/null && echo "          ✓ secondary network" || echo "          - secondary network not found"

# ==============================================================
#  STEP 2: POSTGRES DUMPS
# ==============================================================
echo ""
echo "----------------------------------------------"
echo " STEP 2: PostgreSQL dumps"
echo "----------------------------------------------"

backup_postgres "supabase_db_studio" "studio"
backup_postgres "supabase_db_supabase-secondary" "secondary"

# ==============================================================
#  STEP 3: VOLUME BACKUPS
# ==============================================================
echo ""
echo "----------------------------------------------"
echo " STEP 3: Volume backups"
echo "----------------------------------------------"

VOLUMES=(
  supabase_db_studio
  supabase_storage_studio
  supabase_db_supabase-secondary
  supabase_storage_supabase-secondary
)

for v in "${VOLUMES[@]}"; do
  if docker volume ls --format '{{.Name}}' | grep -q "^${v}$"; then
    backup_volume "$v"
  else
    echo "[SKIP] Volume not found: $v"
  fi
done

# ==============================================================
#  STEP 4: PROJECT CONFIG FILES
# ==============================================================
echo ""
echo "----------------------------------------------"
echo " STEP 4: Project config files"
echo "----------------------------------------------"

PROJECT_DIR="/c/Users/Eitan Baron/Documents/GitHub/studio"
mkdir -p "${BACKUP_DIR}/project_config/supabase"
mkdir -p "${BACKUP_DIR}/project_config/supabase-secondary"

cp "${PROJECT_DIR}/supabase/config.toml"        "${BACKUP_DIR}/project_config/supabase/"         2>/dev/null && echo "[CONFIG] ✓ supabase/config.toml"       || true
cp -r "${PROJECT_DIR}/supabase/migrations"      "${BACKUP_DIR}/project_config/supabase/"         2>/dev/null && echo "[CONFIG] ✓ supabase/migrations/"        || true
cp "${PROJECT_DIR}/supabase/seed.sql"           "${BACKUP_DIR}/project_config/supabase/"         2>/dev/null && echo "[CONFIG] ✓ supabase/seed.sql"           || true
cp -r "${PROJECT_DIR}/supabase/db"              "${BACKUP_DIR}/project_config/supabase/"         2>/dev/null && echo "[CONFIG] ✓ supabase/db/"                || true
cp "${PROJECT_DIR}/supabase-secondary/supabase/config.toml" "${BACKUP_DIR}/project_config/supabase-secondary/" 2>/dev/null && echo "[CONFIG] ✓ supabase-secondary/config.toml" || true
find "${PROJECT_DIR}" -maxdepth 2 -name ".env*" -exec cp {} "${BACKUP_DIR}/project_config/" \; 2>/dev/null && echo "[CONFIG] ✓ .env files" || true

# ==============================================================
#  STEP 5: FINAL ARCHIVE
# ==============================================================
echo ""
echo "----------------------------------------------"
echo " STEP 5: Creating final archive"
echo "----------------------------------------------"

ARCHIVE="${BACKUP_DIR}.tar.gz"
tar czf "$ARCHIVE" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

SIZE=$(du -sh "$ARCHIVE" | cut -f1)
echo ""
echo "=============================================="
echo "  BACKUP COMPLETE!"
echo "  File: $ARCHIVE  ($SIZE)"
echo ""
echo "  Contains:"
echo "   ✓ PostgreSQL full dumps (studio + secondary)"
echo "   ✓ Volume data: db + storage (both stacks)"
echo "   ✓ All container configs (image, env, ports)"
echo "   ✓ Network configs"
echo "   ✓ Project config files + migrations"
echo "=============================================="
