# מעבר למחשב חדש - Studio + Vertex AI

הערכים נלקחו מ־Vercel Project `studio`:
- `PROJECT_ID=albomit`
- `GOOGLE_CLOUD_LOCATION=global`
- `ACCOUNT=eitan2006@gmail.com`

## 1) התקנת Google Cloud SDK (אם עדיין לא מותקן)

```powershell
winget install --id Google.CloudSDK -e
```

אם `gcloud` לא מזוהה אחרי ההתקנה, פתח טרמינל חדש.

## 2) התחברות ל-Google Cloud

```powershell
gcloud auth login eitan2006@gmail.com
gcloud auth application-default login
gcloud config set account eitan2006@gmail.com
```

## 3) בחירת הפרויקט הנכון (ללא placeholder)

```powershell
gcloud config set project albomit
gcloud auth application-default set-quota-project albomit
```

## 4) הגדרת הפרויקט המקומי

```powershell
cd C:\Users\eitan\Documents\GitHub\studio
npm install
npx supabase start
```

## 5) הרצת האפליקציה

```powershell
npm run dev
```

## 6) ערכי Vertex AI ב-`.env.local`

כבר עודכן אצלך בקובץ:

```env
GOOGLE_CLOUD_PROJECT=albomit
GCP_PROJECT_ID=albomit
GOOGLE_CLOUD_LOCATION=global
GOOGLE_GENAI_USE_VERTEXAI=true

GCP_PROJECT_NUMBER=1015831242576
GCP_SERVICE_ACCOUNT_EMAIL=albomit@albomit.iam.gserviceaccount.com
GCP_WORKLOAD_IDENTITY_POOL_ID=albomitpool
GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID=vercel
```

בנוסף, נמחקו מ־`.env.local` המפתחות הישנים:
- `GEMINI_API_KEY`
- `GOOGLE_API_KEY`
- `GOOGLE_GENAI_API_KEY`
