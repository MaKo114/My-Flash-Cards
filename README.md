# My Flash Cards

เว็บเก็บและทบทวนคำศัพท์ภาษาอังกฤษพร้อมความหมายภาษาไทย หนึ่งคำศัพท์เก็บชนิดของคำและความหมายได้หลายรายการ ค้นหาคำศัพท์และความหมาย พร้อมกรองตามชนิดของคำได้ เพิ่มคำใบ้ที่ไม่บังคับให้แต่ละบัตร และกดดูคำใบ้ก่อนพลิกเฉลยได้ โหมด Challenge ฝึกพิมพ์ตามคำหรือฟังเสียงแล้วพิมพ์ โดยถามคำสะกดหนึ่งครั้งต่อรอบ แสดงสีถูกผิดบนการ์ดและกด Enter ไปคำถัดไปได้ อีกแบบใช้พิมพ์ความหมาย ดูเฉลย แล้วประเมินตัวเอง

[Flash Card Web](https://my-flash-cards-puce.vercel.app/)

## สิ่งที่ต้องมี

- Go 1.26 ขึ้นไป (หรือ Go ที่เปิด `GOTOOLCHAIN=auto`)
- Node.js 20.19+/22.12+ และ npm
- Docker Desktop สำหรับ PostgreSQL

## เริ่มใช้งาน

เปิดเทอร์มินัล 3 หน้าต่างที่รากโปรเจกต์:

```powershell
docker compose up -d --wait db
```

```powershell
cd backend
go run ./cmd/server
```

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

เปิด <http://127.0.0.1:5173> ระบบสร้างและปรับตารางฐานข้อมูลให้ตอน backend เริ่มทำงาน ข้อมูลเก็บไว้ใน Docker volume ชื่อ `flashcards_data`

ถ้า backend แจ้ง `connect refused` ที่พอร์ต 5432 ให้เปิด Docker Desktop แล้วรัน `docker compose up -d --wait db` จากรากโปรเจกต์ก่อนเริ่ม backend ฐานใช้งาน `db` ใช้พอร์ต 5432 ส่วน `db-test` ใช้พอร์ต 5433 สำหรับ E2E เท่านั้น เมื่อ Docker Desktop ทำงาน คอนเทนเนอร์ `db` จะเริ่มใหม่อัตโนมัติหลังรีสตาร์ต เว้นแต่สั่งหยุดคอนเทนเนอร์เอง

ค่าปริยายของ backend คือ `DATABASE_URL=postgres://flashcards:flashcards@localhost:5432/flashcards?sslmode=disable` และ `LISTEN_ADDR=127.0.0.1:3001` สามารถเปลี่ยนผ่าน environment variables ได้

CSV ต้องเป็น UTF-8 และมีหัวคอลัมน์ตามลำดับ `คำศัพท์,ชนิดของคำ,ความหมาย` เช่น:

```csv
คำศัพท์,ชนิดของคำ,ความหมาย
apple,noun,แอปเปิล
run,verb,วิ่ง
run,noun,การวิ่ง
about,"verb, preposition","ประมาณ, รอบๆ, เกี่ยวกับ"
```

หนึ่งคำสะกดมีหนึ่งบัตร โดยเก็บชนิดของคำและความหมายเป็นรายการอิสระ ไม่จับคู่ตามลำดับ แถว `run` สองแถวจะรวมเป็นบัตรเดียว หากหลายค่าอยู่ในช่อง CSV เดียวต้องครอบช่องด้วย `"` แถวที่ให้ข้อมูลใหม่กับคำเดิมจะถูกรวมข้อมูล แถวที่ซ้ำทั้งหมดจะถูกข้าม และแถวข้อมูลไม่ครบจะแสดงในสรุปผลนำเข้า การเพิ่มคำสะกดเดิมด้วยฟอร์มจะถูกปฏิเสธ ให้แก้ไขบัตรเดิมเพื่อเพิ่มชนิดหรือความหมาย

## ทดสอบ

เริ่ม PostgreSQL สำหรับทดสอบแยกต่างหากด้วย `docker compose up -d --wait db-test` ก่อน E2E:

```powershell
cd backend
go test ./...
```

```powershell
cd frontend
npm.cmd test
npm.cmd exec playwright install chromium
npm.cmd run test:e2e
npm.cmd run build
```

E2E ใช้ฐานข้อมูล `flashcards_test` ที่พอร์ต 5433 และ backend ทดสอบที่พอร์ต 3002 เท่านั้น โดยลบข้อมูลในฐานทดสอบก่อนเริ่มชุดทดสอบ ไม่แตะข้อมูลในฐานใช้งานปกติ

## API

`GET /api/cards`, `POST /api/cards`, `PUT /api/cards/:id`, `PATCH /api/cards/:id/review`, `DELETE /api/cards/:id`, `POST /api/cards/import` (multipart field `file`)

## ทดลอง Deploy บน Vercel กับ Neon

1. Import repository นี้ใน Vercel ตั้ง Root Directory เป็นรากโปรเจกต์ และเลือก Framework Preset เป็น **Services** ไฟล์ `vercel.json` จะ build `frontend/` ด้วย Vite และ `backend/` ด้วย Go พร้อมส่ง `/api/*` ไปที่ backend
2. ไปที่ Project Settings → Environment Variables แล้วเพิ่ม `DATABASE_URL` โดยนำค่า Neon จาก `backend/.env` ไปใส่ใน Production หากเปิด Preview ควรใช้ Neon branch หรือฐานข้อมูลแยก ห้าม commit ไฟล์ `.env`
3. Deploy แล้วเปิด `/api/health` บน URL ที่ได้ เพื่อตรวจ API และการเชื่อมต่อฐานข้อมูล backend จะรัน migration ที่มีอยู่เมื่อเริ่มทำงาน

GitHub Actions CI ใช้ PostgreSQL ทดสอบชั่วคราวที่พอร์ต 5433 ไม่ใช้ `DATABASE_URL` ของ Neon แอปยังไม่มีระบบล็อกอิน ดังนั้นผู้ที่เข้าถึงเว็บสาธารณะสามารถแก้ไขบัตรได้ ควรเปิด Vercel Deployment Protection ก่อนใช้งานกับข้อมูลส่วนตัว
