#!/bin/bash
# ============================================================
#  SUPABASE BACKUP - ללא קבצי תמונות
#  גיבוי מסד הנתונים בלבד (ללא Storage Volume)
#
#  מה מגובה:
#    ✓ PostgreSQL data volume (supabase_db_studio) - ~37MB
#    ✓ pg_dumpall כSQL גיבוי נוסף
#    ✓ config.toml + migrations + .env files
#
#  מה לא מגובה:
#    ✗ קבצי תמונות (supabase_storage_studio volume)
#      (6,863 קבצים - לא נכללים בכוונה)
#
#  שימוש:
#    bash backup_no_images.sh
#
#  שחזור:
#    bash restore_no_images.sh supabase_backup_no_images_YYYYMMDD_HHMMSS.tar.gz
# ============================================================

set -e

DB_CONTAINER="supabase_db_studio"
BACKUP_DIR="supabase_backup_no_images_$(date +%Y%m%d_%H%M%S)"
PROJECT_DIR="$(dirname "$(cd "$(dirname "$0")" && pwd)/$(basename "$0")")"

# Resolve Docker-safe path (stop Git Bash from mangling Windows paths)
mkdir -p "$BACKUP_DIR"
ABS_DIR="$(cd "${BACKUP_DIR}" && pwd)"
DOCKER_BACKUP_DIR="$(echo "${ABS_DIR}" | sed -E 's|^/([a-zA-Z])/|//\1/|')"

echo "============================================================"
echo "  SUPABASE BACKUP - ללא תמונות"
echo "  תיקייה: $BACKUP_DIR"
echo "============================================================"
echo ""

# ── Sanity checks ─────────────────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "ERROR: Container '$DB_CONTAINER' לא רץ. הפעל Supabase תחילה."
  rm -rf "$BACKUP_DIR"
  exit 1
fi
echo "[CHECK] ✓ Container '$DB_CONTAINER' פועל"

# ── STEP 1: pg_dumpall (SQL גיבוי, containers פועלים) ─────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 1: pg_dumpall (גיבוי SQL - containers פועלים)"
echo "--------------------------------------------------------------"
docker exec -t "$DB_CONTAINER" pg_dumpall -U postgres > "${BACKUP_DIR}/pgdumpall.sql"
echo "[SQL] ✓ pgdumpall.sql ($(du -sh "${BACKUP_DIR}/pgdumpall.sql" | cut -f1))"

# ── STEP 2: עצירת containers לגיבוי volume עקבי ──────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 2: עצירת containers לגיבוי Volume עקבי (זמני)"
echo "--------------------------------------------------------------"

STUDIO_CONTAINERS=(
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
)

STOPPED_CONTAINERS=()
for c in "${STUDIO_CONTAINERS[@]}"; do
  if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
    docker stop "$c" > /dev/null 2>&1
    STOPPED_CONTAINERS+=("$c")
    echo "[STOP] ✓ $c"
  fi
done

# ── STEP 3: גיבוי DB Volume בלבד (ללא Storage) ────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 3: גיבוי PostgreSQL Volume (ללא קבצי תמונות)"
echo "--------------------------------------------------------------"

if docker volume ls --format '{{.Name}}' | grep -q "^supabase_db_studio$"; then
  echo "[VOLUME] מגבה supabase_db_studio ..."
  MSYS_NO_PATHCONV=1 docker run --rm \
    -v "supabase_db_studio:/data:ro" \
    -v "${DOCKER_BACKUP_DIR}:/backup" \
    alpine \
    tar czf "/backup/supabase_db_studio.tar.gz" -C /data .
  echo "[VOLUME] ✓ supabase_db_studio.tar.gz ($(du -sh "${BACKUP_DIR}/supabase_db_studio.tar.gz" | cut -f1))"
else
  echo "[WARN] Volume supabase_db_studio לא נמצא!"
fi

echo ""
echo "[SKIP] supabase_storage_studio - קבצי תמונות לא מגובים בכוונה"

# ── STEP 4: הפעלה מחדש של containers ────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 4: הפעלה מחדש של containers"
echo "--------------------------------------------------------------"

for c in "${STOPPED_CONTAINERS[@]}"; do
  docker start "$c" > /dev/null 2>&1
  echo "[START] ✓ $c"
done

# ── STEP 5: גיבוי קבצי config ───────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 5: גיבוי קבצי config ו-migrations"
echo "--------------------------------------------------------------"

mkdir -p "${BACKUP_DIR}/project_config"

# supabase/ config
if [ -d "${PROJECT_DIR}/supabase" ]; then
  cp -r "${PROJECT_DIR}/supabase" "${BACKUP_DIR}/project_config/supabase"
  echo "[CONFIG] ✓ supabase/ (config.toml, migrations, seed.sql, etc.)"
fi

# .env files
find "${PROJECT_DIR}" -maxdepth 1 -name ".env*" | while read f; do
  cp "$f" "${BACKUP_DIR}/project_config/"
  echo "[CONFIG] ✓ $(basename "$f")"
done

# container image versions
docker inspect "$DB_CONTAINER" --format '{{.Config.Image}}' > "${BACKUP_DIR}/project_config/db_image_version.txt" 2>/dev/null
docker ps --filter "name=_studio" --format "table {{.Names}}\t{{.Image}}" > "${BACKUP_DIR}/project_config/container_images.txt" 2>/dev/null

echo "[CONFIG] ✓ גרסאות containers נשמרו"

# ── STEP 6: קובץ מידע על הגיבוי ────────────────────────────
echo ""
cat > "${BACKUP_DIR}/BACKUP_INFO.txt" << EOF
SUPABASE BACKUP - ללא תמונות
=============================
תאריך:        $(date)
מחשב מקור:   $(hostname)
DB גודל:      $(docker exec $DB_CONTAINER psql -U postgres -t -c "SELECT pg_size_pretty(pg_database_size('postgres'));" 2>/dev/null | tr -d ' ')

מה מגובה:
  ✓ supabase_db_studio.tar.gz  - PostgreSQL data (כל הנתונים ללא תמונות)
  ✓ pgdumpall.sql              - גיבוי SQL כפול לבטיחות
  ✓ project_config/            - config.toml, migrations, .env

מה לא מגובה:
  ✗ supabase_storage_studio   - קבצי תמונות (6,863 קבצים)
    התמונות לא ייטענו אחרי שחזור - זה צפוי ומכוון

שחזור:
  bash restore_no_images.sh $(basename "${BACKUP_DIR}").tar.gz

הערות:
  - לאחר שחזור, storage.objects יכיל מטאדאטה על תמונות שלא קיימות
  - האפליקציה תעבוד אך תמונות לא יוצגו
  - ניתן לבחור לנקות את storage.objects בעת שחזור (ראה restore script)
EOF

echo "[INFO] ✓ BACKUP_INFO.txt נוצר"

# ── STEP 7: יצירת archive ──────────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 7: דחיסה לקובץ archive"
echo "--------------------------------------------------------------"

ARCHIVE="${BACKUP_DIR}.tar.gz"
tar czf "$ARCHIVE" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

SIZE=$(du -sh "$ARCHIVE" | cut -f1)
echo ""
echo "============================================================"
echo "  גיבוי הושלם!"
echo "  קובץ: $ARCHIVE  ($SIZE)"
echo ""
echo "  מכיל:"
echo "   ✓ PostgreSQL data volume (ללא תמונות)"
echo "   ✓ pg_dumpall SQL"
echo "   ✓ config + migrations"
echo ""
echo "  שחזור במחשב אחר:"
echo "   1. העתק את $ARCHIVE למחשב היעד"
echo "   2. הפעל Supabase: cd <project_dir> && supabase start"
echo "   3. הרץ: bash restore_no_images.sh $ARCHIVE"
echo "============================================================"
