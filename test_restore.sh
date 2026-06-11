#!/bin/bash
# ============================================================
#  בדיקת שחזור גיבוי - instance בשם studio_test
#  יוצר instance חדש לגמרי ללא פגיעה ב-studio המקורי
#
#  Usage: bash test_restore.sh <backup_archive.tar.gz>
#  Cleanup: bash test_restore.sh --cleanup
# ============================================================

set -e

BACKUP_ARCHIVE="$1"
TEST_PROJECT="studio_test"
TEST_DIR="/c/Users/eitan/Documents/GitHub/${TEST_PROJECT}"

# ports שונים לחלוטין מה-studio המקורי (64xxx)
TEST_API_PORT=54321
TEST_DB_PORT=54322
TEST_DB_SHADOW_PORT=54320
TEST_DB_POOLER_PORT=54329
TEST_STUDIO_PORT=54323
TEST_INBUCKET_PORT=54324
TEST_ANALYTICS_PORT=54327

# ── cleanup mode ──────────────────────────────────────────────
if [ "$1" == "--cleanup" ]; then
  echo "============================================================"
  echo "  מנקה את studio_test instance"
  echo "============================================================"
  for c in $(docker ps -a --format '{{.Names}}' | grep "_${TEST_PROJECT}$"); do
    docker stop "$c" > /dev/null 2>&1 && docker rm "$c" > /dev/null 2>&1
    echo "[REMOVE] ✓ container: $c"
  done
  for v in $(docker volume ls --format '{{.Name}}' | grep "_${TEST_PROJECT}$"); do
    docker volume rm "$v" > /dev/null 2>&1
    echo "[REMOVE] ✓ volume: $v"
  done
  for n in $(docker network ls --format '{{.Name}}' | grep "_${TEST_PROJECT}$"); do
    docker network rm "$n" > /dev/null 2>&1
    echo "[REMOVE] ✓ network: $n"
  done
  rm -rf "$TEST_DIR"
  echo "[REMOVE] ✓ directory: $TEST_DIR"
  echo ""
  echo "✓ studio_test נוקה לחלוטין"
  exit 0
fi

# ── בדיקת archive ─────────────────────────────────────────────
if [ -z "$BACKUP_ARCHIVE" ] || [ ! -f "$BACKUP_ARCHIVE" ]; then
  echo "Usage: bash test_restore.sh <backup_archive.tar.gz>"
  echo "       bash test_restore.sh --cleanup"
  exit 1
fi

echo "============================================================"
echo "  בדיקת שחזור גיבוי → ${TEST_PROJECT}"
echo "  גיבוי: $BACKUP_ARCHIVE"
echo "  Studio UI: http://localhost:${TEST_STUDIO_PORT}"
echo "============================================================"
echo ""

# ── STEP 1: יצירת project directory ──────────────────────────
echo "--------------------------------------------------------------"
echo " STEP 1: יצירת ספריית ${TEST_PROJECT}"
echo "--------------------------------------------------------------"

if [ -d "$TEST_DIR" ]; then
  echo "[INFO] ספרייה כבר קיימת: $TEST_DIR"
else
  mkdir -p "$TEST_DIR"
  echo "[DIR] ✓ נוצרה: $TEST_DIR"
fi

mkdir -p "${TEST_DIR}/supabase/migrations"

# ── STEP 2: יצירת config.toml עם ports שונים ─────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 2: config.toml עם ports ייחודיים"
echo "--------------------------------------------------------------"

cat > "${TEST_DIR}/supabase/config.toml" << EOF
project_id = "${TEST_PROJECT}"

[api]
enabled = true
port = ${TEST_API_PORT}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[api.tls]
enabled = false

[db]
port = ${TEST_DB_PORT}
shadow_port = ${TEST_DB_SHADOW_PORT}
health_timeout = "2m"
major_version = 17

[db.pooler]
enabled = false
port = ${TEST_DB_POOLER_PORT}
pool_mode = "transaction"
default_pool_size = 20
max_client_conn = 100

[db.migrations]
enabled = false

[db.seed]
enabled = false

[realtime]
enabled = true

[studio]
enabled = true
port = ${TEST_STUDIO_PORT}
api_url = "http://127.0.0.1"

[inbucket]
enabled = true
port = ${TEST_INBUCKET_PORT}

[storage]
enabled = true
file_size_limit = "50MiB"

[storage.s3_protocol]
enabled = false

[storage.analytics]
enabled = false

[storage.vector]
enabled = false

[auth]
enabled = true
site_url = "http://127.0.0.1:3000"
additional_redirect_urls = ["https://127.0.0.1:3000"]
jwt_expiry = 3600
enable_refresh_token_rotation = true
refresh_token_reuse_interval = 10
enable_signup = true
enable_anonymous_sign_ins = false
enable_manual_linking = false
minimum_password_length = 6
password_requirements = ""

[auth.rate_limit]
email_sent = 2
sms_sent = 30
anonymous_users = 30
token_refresh = 150
sign_in_sign_ups = 30
token_verifications = 30
web3 = 30

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false
secure_password_change = false
max_frequency = "1s"
otp_length = 6
otp_expiry = 3600

[auth.sms]
enable_signup = false
enable_confirmations = false
template = "Your code is {{ .Code }}"
max_frequency = "5s"

[auth.sms.twilio]
enabled = false
account_sid = ""
message_service_sid = ""
auth_token = "env(SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN)"

[auth.mfa]
max_enrolled_factors = 10

[auth.mfa.totp]
enroll_enabled = false
verify_enabled = false

[auth.mfa.phone]
enroll_enabled = false
verify_enabled = false
otp_length = 6
template = "Your code is {{ .Code }}"
max_frequency = "5s"

[auth.external.apple]
enabled = false
client_id = ""
secret = "env(SUPABASE_AUTH_EXTERNAL_APPLE_SECRET)"
redirect_uri = ""
url = ""
skip_nonce_check = false
email_optional = false

[auth.web3.solana]
enabled = false

[auth.third_party.firebase]
enabled = false

[auth.third_party.auth0]
enabled = false

[auth.third_party.aws_cognito]
enabled = false

[auth.third_party.clerk]
enabled = false

[auth.oauth_server]
enabled = false
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = false

[edge_runtime]
enabled = true
policy = "per_worker"
inspector_port = 8084
deno_version = 2

[analytics]
enabled = true
port = ${TEST_ANALYTICS_PORT}
backend = "postgres"

[experimental]
orioledb_version = ""
s3_host = "env(S3_HOST)"
s3_region = "env(S3_REGION)"
s3_access_key = "env(S3_ACCESS_KEY)"
s3_secret_key = "env(S3_SECRET_KEY)"
EOF

echo "[CONFIG] ✓ config.toml נוצר (ports: API=${TEST_API_PORT}, DB=${TEST_DB_PORT}, Studio=${TEST_STUDIO_PORT})"

# ── STEP 3: הפעלת studio_test ─────────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 3: הפעלת supabase start ב-${TEST_PROJECT}"
echo " (זה יכול לקחת 1-3 דקות)"
echo "--------------------------------------------------------------"

cd "$TEST_DIR"
npx supabase start 2>&1
cd - > /dev/null

echo "[SUPABASE] ✓ ${TEST_PROJECT} הופעל"

# ── וידוא containers ──────────────────────────────────────────
echo ""
echo "[CHECK] containers שנוצרו:"
docker ps --filter "name=_${TEST_PROJECT}" --format "  {{.Names}} → {{.Status}}" | sort

# ── STEP 4: עצירה לשחזור volume ──────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 4: עצירת containers לשחזור"
echo "--------------------------------------------------------------"

STOPPED=()
for c in $(docker ps --format '{{.Names}}' | grep "_${TEST_PROJECT}$" | sort -r); do
  docker stop "$c" > /dev/null 2>&1
  STOPPED+=("$c")
  echo "[STOP] ✓ $c"
done

# ── STEP 5: שחזור DB volume ───────────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 5: שחזור PostgreSQL volume לתוך ${TEST_PROJECT}"
echo "--------------------------------------------------------------"

RESTORE_TMP="./supabase_restore_tmp_test_$$"
mkdir -p "$RESTORE_TMP"
tar xzf "$BACKUP_ARCHIVE" -C "$RESTORE_TMP" --strip-components=1

ABS_RESTORE="$(cd "${RESTORE_TMP}" && pwd)"
DOCKER_RESTORE_DIR="$(echo "${ABS_RESTORE}" | sed -E 's|^/([a-zA-Z])/|//\1/|')"

TARGET_VOLUME="supabase_db_${TEST_PROJECT}"
echo "[VOLUME] משחזר לתוך: ${TARGET_VOLUME}"

docker volume create "$TARGET_VOLUME" > /dev/null 2>&1 || true

MSYS_NO_PATHCONV=1 docker run --rm \
  -v "${TARGET_VOLUME}:/data" \
  -v "${DOCKER_RESTORE_DIR}:/backup:ro" \
  alpine \
  sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null || true; tar xzf /backup/supabase_db_studio.tar.gz -C /data"

echo "[VOLUME] ✓ PostgreSQL data שוחזר"
rm -rf "$RESTORE_TMP"

# ── STEP 6: הפעלה מחדש ───────────────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 6: הפעלה מחדש של ${TEST_PROJECT}"
echo "--------------------------------------------------------------"

for c in "${STOPPED[@]}"; do
  docker start "$c" > /dev/null 2>&1 && echo "[START] ✓ $c" || echo "[WARN] $c"
done

# ── המתנה ל-Postgres ──────────────────────────────────────────
echo ""
echo "[WAIT] ממתין ל-PostgreSQL..."
DB_CONTAINER="supabase_db_${TEST_PROJECT}"
for i in $(seq 1 30); do
  if docker exec "$DB_CONTAINER" pg_isready -U postgres > /dev/null 2>&1; then
    echo "[WAIT] ✓ PostgreSQL מוכן ($((i*2))s)"
    break
  fi
  sleep 2
  echo "[WAIT] $((i*2))s..."
done

# ── STEP 7: אימות נתונים ──────────────────────────────────────
echo ""
echo "--------------------------------------------------------------"
echo " STEP 7: אימות נתונים"
echo "--------------------------------------------------------------"

echo ""
echo "ספירת שורות בטבלאות עיקריות:"
docker exec "$DB_CONTAINER" psql -U postgres -c "
SELECT
  'albums'   AS table_name, count(*) FROM public.albums  UNION ALL
  SELECT 'photos',   count(*) FROM public.photos          UNION ALL
  SELECT 'templates',count(*) FROM public.templates       UNION ALL
  SELECT 'auth.users',count(*) FROM auth.users            UNION ALL
  SELECT 'storage.buckets',count(*) FROM storage.buckets
ORDER BY table_name;" 2>/dev/null

echo ""
echo "============================================================"
echo "  ✓ studio_test מוכן עם הנתונים מהגיבוי!"
echo ""
echo "  גישה:"
echo "   Studio UI:  http://localhost:${TEST_STUDIO_PORT}"
echo "   DB:         postgresql://postgres:postgres@localhost:${TEST_DB_PORT}/postgres"
echo ""
echo "  הinstance המקורי (studio) ממשיך לרוץ ללא שינוי:"
echo "   Studio UI:  http://localhost:64323"
echo ""
echo "  לניקוי בסיום הבדיקה:"
echo "   bash test_restore.sh --cleanup"
echo "============================================================"
