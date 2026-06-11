#!/bin/bash
# ============================================================
#  SUPABASE RESTORE - שחזור ללא תמונות
#  Usage: bash restore_no_images.sh <backup_archive.tar.gz>
#
#  דרישות מוקדמות במחשב היעד:
#    1. Docker Desktop מותקן ופועל
#    2. Supabase CLI מותקן (npm install -g supabase)
#    3. קבצי הפרויקט מועתקים (git clone / העתקה)
#    4. supabase start הורץ לפחות פעם אחת (ליצירת containers)
#
#  מה השחזור עושה:
#    ✓ מחליף את PostgreSQL data volume בגיבוי
#    ✓ כל נתוני האפליקציה (albums, photos metadata, users, etc.)
#    ✗ תמונות לא ישוחזרו (storage volume לא מגובה)
#
#  הערה: לאחר שחזור, storage.objects יכיל ~6863 רשומות
#  שמצביעות לקבצים שלא קיימים. האפליקציה תעבוד אך
#  תמונות לא יוצגו (404). ניתן לנקות זאת עם --clean-storage.
# ============================================================

set -e

# ── אופציות ──────────────────────────────────────────────────
CLEAN_STORAGE=false
for arg in "$@"; do
  case $arg in
    --clean-storage) CLEAN_STORAGE=true ;;
  esac
done

# ── קבלת ה-archive ───────────────────────────────────────────
ARCHIVE=""
for arg in "$@"; do
  if [[ "$arg" == *.tar.gz ]]; then
    ARCHIVE="$arg"
  fi
done

if [ -z "$ARCHIVE" ]; then
  echo "שימוש: bash restore_no_images.sh <backup_archive.tar.gz> [--clean-storage]"
  echo ""
  echo "  --clean-storage   מנקה את storage.objects לאחר שחזור"
  echo "                    (מונע שגיאות 404 על תמונות חסרות)"
  exit 1
fi

if [ ! -f "$ARCHIVE" ]; then
  echo "ERROR: קובץ לא נמצא: $ARCHIVE"
  exit 1
fi

DB_CONTAINER="supabase_db_studio"
RESTORE_TMP="./supabase_restore_tmp_$$"

echo "============================================================"
echo "  SUPABASE RESTORE - ללא תמונות"
echo "  מקור: $ARCHIVE"
if $CLEAN_STORAGE; then
  echo "  מצב: --clean-storage (storage.objects ינוקה)"
fi
echo "============================================================"
echo ""

# ── בדיקות מוקדמות ───────────────────────────────────────────
echo "[CHECK] בודק Docker..."
if ! docker info > /dev/null 2>&1; then
  echo "ERROR: Docker לא פועל. הפעל Docker Desktop תחילה."
  exit 1
fi
echo "[CHECK] ✓ Docker פועל"

echo "[CHECK] בודק containers..."
if ! docker ps -a --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo ""
  echo "ERROR: Container '$DB_CONTAINER' לא נמצא!"
  echo ""
  echo "  יש להפעיל Supabase תחילה:"
  echo "    cd <project_directory>"
  echo "    supabase start"
  echo ""
  echo "  לאחר מכן הרץ שוב את הסקריפט."
  exit 1
fi
echo "[CHECK] ✓ Containers קיימים"

# ── אישור מהמשתמש ────────────────────────────────────────────
echo ""
echo "⚠️  אזהרה: פעולה זו תחליף את כל הנתונים ב-${DB_CONTAINER}!"
echo "   לחץ Enter להמשך, או Ctrl+C לביטול..."
read -r

# ── חילוץ archive ─────────────────────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 1: חילוץ הגיבוי"
echo "--------------------------------------------------------------"
rm -rf "$RESTORE_TMP"
mkdir -p "$RESTORE_TMP"
tar xzf "$ARCHIVE" -C "$RESTORE_TMP" --strip-components=1
echo "[EXTRACT] ✓ הגיבוי חולץ"

# Resolve Docker-safe path
ABS_RESTORE="$(cd "${RESTORE_TMP}" && pwd)"
DOCKER_RESTORE_DIR="$(echo "${ABS_RESTORE}" | sed -E 's|^/([a-zA-Z])/|//\1/|')"

# ── עצירת containers ──────────────────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 2: עצירת containers"
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
  else
    echo "[SKIP] לא רץ: $c"
  fi
done

# ── שחזור DB Volume ───────────────────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 3: שחזור PostgreSQL data volume"
echo "--------------------------------------------------------------"

VOLUME_BACKUP="${RESTORE_TMP}/supabase_db_studio.tar.gz"
if [ ! -f "$VOLUME_BACKUP" ]; then
  echo "ERROR: קובץ גיבוי volume לא נמצא: supabase_db_studio.tar.gz"
  # restart containers before exit
  for c in "${STOPPED_CONTAINERS[@]}"; do docker start "$c" > /dev/null 2>&1 || true; done
  rm -rf "$RESTORE_TMP"
  exit 1
fi

echo "[VOLUME] מוחק volume קיים ומשחזר..."
docker volume create supabase_db_studio > /dev/null 2>&1 || true

MSYS_NO_PATHCONV=1 docker run --rm \
  -v "supabase_db_studio:/data" \
  -v "${DOCKER_RESTORE_DIR}:/backup:ro" \
  alpine \
  sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null || true; tar xzf /backup/supabase_db_studio.tar.gz -C /data"

echo "[VOLUME] ✓ supabase_db_studio שוחזר"

echo ""
echo "[SKIP] supabase_storage_studio - לא משוחזר (תמונות לא בגיבוי)"

# ── הפעלה מחדש ───────────────────────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 4: הפעלה מחדש של containers"
echo "--------------------------------------------------------------"

# Start db first, then rest
for c in "${STOPPED_CONTAINERS[@]}"; do
  docker start "$c" > /dev/null 2>&1 && echo "[START] ✓ $c" || echo "[WARN] Failed to start: $c"
done

# ── המתנה ל-Postgres ──────────────────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 5: המתנה ל-PostgreSQL"
echo "--------------------------------------------------------------"
echo "[WAIT] ממתין ל-PostgreSQL..."
for i in $(seq 1 30); do
  if docker exec "$DB_CONTAINER" pg_isready -U postgres > /dev/null 2>&1; then
    echo "[WAIT] ✓ PostgreSQL מוכן ($((i*2))s)"
    break
  fi
  sleep 2
  echo "[WAIT] עדיין ממתין... ($((i*2))s)"
done

# ── ניקוי storage.objects (אופציונלי) ─────────────────────────
if $CLEAN_STORAGE; then
  echo ""
  echo "--------------------------------------------------------------"
  echo " STEP 6: ניקוי storage.objects (--clean-storage)"
  echo "--------------------------------------------------------------"
  echo "[SQL] מנקה storage.objects ו-storage.buckets..."
  docker exec "$DB_CONTAINER" psql -U postgres -c \
    "TRUNCATE storage.objects; TRUNCATE storage.buckets CASCADE;" 2>/dev/null && \
    echo "[SQL] ✓ storage.objects נוקה - Storage יתחיל ריק" || \
    echo "[WARN] לא הצלחתי לנקות storage.objects"
fi

# ── שחזור config files (אופציונלי) ───────────────────────────
if [ -d "${RESTORE_TMP}/project_config/supabase" ]; then
  echo ""
  echo "--------------------------------------------------------------"
  echo " שחזור קבצי config (אופציונלי)"
  echo "--------------------------------------------------------------"
  echo "[INFO] קבצי config נמצאו בגיבוי."
  echo "[INFO] האם לשחזר אותם לתיקיית הפרויקט?"
  echo "       (y = כן, Enter = דלג)"
  read -r RESTORE_CONFIG
  if [[ "$RESTORE_CONFIG" == "y" || "$RESTORE_CONFIG" == "Y" ]]; then
    PROJECT_DIR="$(pwd)"
    cp -r "${RESTORE_TMP}/project_config/supabase/." "${PROJECT_DIR}/supabase/" 2>/dev/null && \
      echo "[CONFIG] ✓ supabase/ config שוחזר" || true
    for f in "${RESTORE_TMP}"/project_config/.env*; do
      [ -f "$f" ] && cp "$f" "${PROJECT_DIR}/" && echo "[CONFIG] ✓ $(basename "$f") שוחזר" || true
    done
  else
    echo "[SKIP] config files לא שוחזרו"
  fi
fi

# ── ניקוי temp ────────────────────────────────────────────────
rm -rf "$RESTORE_TMP"

# ── סיכום ────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  שחזור הושלם!"
echo ""
echo "  ✓ PostgreSQL data שוחזר (albums, photos metadata, users)"
if $CLEAN_STORAGE; then
  echo "  ✓ Storage נוקה (תתחיל עם storage ריק)"
else
  echo "  ⚠️  storage.objects מכיל ~6863 רשומות לקבצים חסרים"
  echo "     תמונות לא יוצגו (קבצים לא קיימים בvolume)"
  echo "     לניקוי: הרץ שוב עם --clean-storage"
fi
echo ""
echo "  בדוק Docker Desktop - כל containers צריכים להיות ירוקים"
echo "  Studio: http://localhost:64323"
echo "============================================================"
