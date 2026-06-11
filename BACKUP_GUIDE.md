# מדריך גיבוי ושחזור - Supabase Studio

## מה הגיבוי כולל

| מה | כלול? |
|----|--------|
| כל הנתונים (albums, photos, templates, users) | ✅ כן |
| הגדרות Auth (משתמשים, sessions) | ✅ כן |
| Storage buckets (הגדרות) | ✅ כן |
| קבצי config + migrations | ✅ כן |
| **קבצי תמונות פיזיים** | ❌ לא (בכוונה) |

הגיבוי יוצא **~64MB** בלבד (במקום GB עם תמונות).

---

## גיבוי

### פקודה
```bash
bash backup_no_images.sh
```

### מה קורה
1. מריץ `pg_dumpall` (גיבוי SQL)
2. עוצר את כל ה-containers **זמנית** (כמה שניות) לגיבוי עקבי
3. מגבה את ה-PostgreSQL data volume
4. מפעיל מחדש את כל ה-containers
5. יוצר קובץ archive: `supabase_backup_no_images_YYYYMMDD_HHMMSS.tar.gz`

### פלט לדוגמה
```
[CHECK] ✓ Container 'supabase_db_studio' פועל
[SQL]   ✓ pgdumpall.sql (17M)
[STOP]  ✓ כל ה-containers נעצרו
[VOLUME]✓ supabase_db_studio.tar.gz (59M)
[START] ✓ כל ה-containers הופעלו מחדש
[CONFIG]✓ supabase/ + .env נשמרו

גיבוי הושלם! קובץ: supabase_backup_no_images_20260611_220818.tar.gz (64M)
```

---

## שחזור במחשב אחר

### דרישות מוקדמות במחשב היעד

```
1. Docker Desktop - מותקן ופועל
2. Node.js + npm - מותקן
3. קבצי הפרויקט - git clone או העתקה ידנית
4. קובץ הגיבוי - הועתק למחשב
```

### שלבים

**שלב 1 - הפעלת Supabase (פעם ראשונה בלבד)**
```bash
cd C:\Users\<שם-משתמש>\Documents\GitHub\studio
npx supabase start
# ← יוצר את כל 12 ה-containers (ריקים)
# ← לוקח 2-5 דקות בפעם הראשונה
```

**שלב 2 - שחזור הנתונים**
```bash
# אפשרות א: שחזור נקי (מומלץ) - בלי רשומות תמונות חסרות
bash restore_no_images.sh supabase_backup_no_images_YYYYMMDD_HHMMSS.tar.gz --clean-storage

# אפשרות ב: שחזור מלא - כולל metadata של תמונות (תיצור 404 בטעינת תמונות)
bash restore_no_images.sh supabase_backup_no_images_YYYYMMDD_HHMMSS.tar.gz
```

**שלב 3 - גישה**
```
Studio UI:  http://localhost:64323
DB direct:  postgresql://postgres:postgres@localhost:64322/postgres
API:        http://localhost:64321
```

### מה `--clean-storage` עושה?
ניקוי טבלת `storage.objects` - מסיר את כל ה-6863 רשומות שמצביעות לתמונות שלא קיימות.
- **עם** `--clean-storage`: האפליקציה עובדת חלקה, storage מתחיל ריק
- **בלי** `--clean-storage`: האפליקציה עובדת, אבל תמונות ישנות יחזירו 404

---

## בדיקת גיבוי (ב-Docker הנוכחי)

ליצור instance בדיקה בשם `studio_test` **ללא פגיעה** ב-studio המקורי:

```bash
bash test_restore.sh supabase_backup_no_images_YYYYMMDD_HHMMSS.tar.gz
```

**מה קורה:**
- יוצר instance חדש לגמרי עם ports שונים (54xxx)
- משחזר את הגיבוי לתוכו
- מדפיס ספירת שורות לאימות

**גישה ל-studio_test:**
```
Studio UI:  http://localhost:54323
DB:         postgresql://postgres:postgres@localhost:54322/postgres
```

**ניקוי אחרי הבדיקה:**
```bash
bash test_restore.sh --cleanup
# ← מוחק את כל containers, volumes, networks של studio_test
```

---

## Ports - השוואה

| שירות | studio (מקורי) | studio_test (בדיקה) |
|--------|---------------|---------------------|
| Studio UI | :64323 | :54323 |
| API (Kong) | :64321 | :54321 |
| PostgreSQL | :64322 | :54322 |
| Inbucket | :64324 | :54324 |
| Analytics | :64327 | :54327 |

---

## קבצי הסקריפטים

| קובץ | תפקיד |
|------|--------|
| `backup_no_images.sh` | יצירת גיבוי חדש |
| `restore_no_images.sh` | שחזור במחשב יעד |
| `test_restore.sh` | בדיקת גיבוי ב-Docker הנוכחי |

---

## הערות חשובות

> **תמונות לא ישוחזרו** - זה מכוון. האפליקציה תעבוד אך תמונות לא יוצגו.
> כדי שתמונות יוצגו, יש להעלות אותן מחדש דרך האפליקציה.

> **הגיבוי הנוכחי** נמצא ב:
> `studio\supabase_backup_no_images_20260611_220818.tar.gz` (64MB)
