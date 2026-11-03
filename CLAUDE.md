# CLAUDE.md

เว็บ flash card คำศัพท์อังกฤษ–ไทย (ชื่อแอป wordly) รายละเอียดการใช้งานอยู่ใน [README.md](README.md) ความต้องการเดิมอยู่ใน [context.md](context.md)

## กฎของโปรเจกต์

- **ถามก่อนเพิ่มฟีเจอร์ใหม่ทุกครั้ง** เสนอได้ แต่ห้ามลงมือจนกว่าผู้ใช้ตกลง
- **ก่อน commit ต้องผ่านทั้ง unit test และ e2e** (ดูคำสั่งด้านล่าง) ถ้าผู้ใช้ไม่ได้สั่งให้ commit ให้แก้ไฟล์ไว้เฉย ๆ ผู้ใช้จะ commit/push เอง
- ข้อความบนหน้าเว็บเป็นภาษาไทย ชื่อโหมด `Challenge` และป้าย `ENG`/`THAI` คงไว้ตามเดิม
- เมื่อพฤติกรรมเปลี่ยน ให้อัปเดต [docs/acceptance-criteria.md](docs/acceptance-criteria.md) (และ [docs/user-stories.md](docs/user-stories.md), [openapi.yaml](openapi.yaml) ถ้าเกี่ยวข้อง)

## Stack

- `frontend/`: React + Vite + TypeScript, Tailwind v4, คอมโพเนนต์แบบ shadcn ใน `src/components/ui`, ไอคอน lucide-react UI ส่วนใหญ่อยู่ใน `src/App.tsx` ฟังก์ชันล้วนอยู่ใน `src/lib/cards.ts`
- `backend/`: Go + Fiber v3 แบบ clean architecture ตาราง/migration สร้างตอน server เริ่ม
- PostgreSQL ผ่าน `compose.yaml`: `db` พอร์ต 5432 (ใช้งานจริง), `db-test` พอร์ต 5433 (e2e เท่านั้น)

## คำสั่ง

รันจากรากโปรเจกต์ (Windows ใช้ `npm.cmd` ใน PowerShell ได้)

```sh
docker compose up -d --wait db-test   # ต้องเปิดก่อน e2e ทุกครั้ง Docker Desktop เปิดอยู่ไม่ได้แปลว่า db-test เปิด
cd frontend
npx tsc -b            # type check
npm test              # unit test (vitest)
npm run test:e2e      # e2e (playwright) build backend ทดสอบเอง ใช้ API พอร์ต 3002, เว็บพอร์ต 4173
npm run build
cd ../backend && go test ./...
```

e2e ล้างข้อมูลในฐาน `flashcards_test` เอง ไม่แตะฐานใช้งานจริง

## ข้อควรระวัง

- โฟลเดอร์ `vocabulary/` เป็นไฟล์ CSV ส่วนตัวของผู้ใช้ที่ยังไม่ได้ track อย่า `git add` โดยไม่ถาม
- การ์ดใน Challenge ถูก `key` ตามรอบ/คำ/โหมด จึง remount ทุกคำ (`autoFocus` ทำงานทุกคำ)
- ตรวจ UI ทั้งมือถือ (390px), notebook (~1280px) และ desktop (1440px+)
