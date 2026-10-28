# My Flash Cards

เว็บเก็บและทบทวนคำศัพท์ภาษาอังกฤษพร้อมความหมายภาษาไทย ใช้ในเครื่องสำหรับผู้ใช้คนเดียว ค้นหาคำศัพท์ ชนิดของคำ และความหมายในคลังได้ เพิ่มคำใบ้ที่ไม่บังคับให้แต่ละบัตร และกดดูคำใบ้ก่อนพลิกเฉลยได้ โหมด Challenge ฝึกพิมพ์ตามคำหรือฟังเสียงแล้วพิมพ์ โดยแสดงสีถูกผิดบนการ์ดและกด Enter ไปคำถัดไปได้ อีกแบบใช้พิมพ์ความหมาย ดูเฉลย แล้วประเมินตัวเอง

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
```

คำศัพท์กับชนิดของคำที่ซ้ำกันโดยไม่สนตัวพิมพ์จะถูกข้ามเมื่อ import และถูกปฏิเสธเมื่อเพิ่มหรือแก้ไขด้วยตนเอง แถวข้อมูลไม่ครบจะแสดงในสรุปผลนำเข้า

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
