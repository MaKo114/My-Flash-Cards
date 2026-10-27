package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"my-flash-cards/backend/internal/application"
	"my-flash-cards/backend/internal/domain"
)

type Handler struct{ service *application.Service }

func New(service *application.Service) *Handler { return &Handler{service: service} }

func (h *Handler) Register(app *fiber.App) {
	api := app.Group("/api")
	api.Get("/health", func(c fiber.Ctx) error { return c.JSON(fiber.Map{"ok": true}) })
	api.Get("/cards", h.list)
	api.Post("/cards", h.create)
	api.Put("/cards/:id", h.update)
	api.Patch("/cards/:id/review", h.review)
	api.Delete("/cards/:id", h.delete)
	api.Post("/cards/import", h.importCSV)
}

func requestContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 10*time.Second)
}

func respondError(c fiber.Ctx, err error) error {
	status := fiber.StatusInternalServerError
	message := "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง"
	switch {
	case errors.Is(err, domain.ErrInvalid), errors.Is(err, application.ErrCSVHeader), errors.Is(err, application.ErrCSVEncoding):
		status, message = fiber.StatusBadRequest, err.Error()
	case errors.Is(err, domain.ErrDuplicate):
		status, message = fiber.StatusConflict, err.Error()
	case errors.Is(err, domain.ErrNotFound):
		status, message = fiber.StatusNotFound, err.Error()
	}
	return c.Status(status).JSON(fiber.Map{"error": message})
}

func parseID(c fiber.Ctx) (int64, error) {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil || id < 1 {
		return 0, domain.ErrInvalid
	}
	return id, nil
}

func fields(c fiber.Ctx) (domain.Fields, error) {
	var value domain.Fields
	if err := json.Unmarshal(c.Body(), &value); err != nil {
		return value, domain.ErrInvalid
	}
	return value, nil
}

func (h *Handler) list(c fiber.Ctx) error {
	ctx, cancel := requestContext()
	defer cancel()
	cards, err := h.service.List(ctx)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(cards)
}

func (h *Handler) create(c fiber.Ctx) error {
	value, err := fields(c)
	if err != nil {
		return respondError(c, err)
	}
	ctx, cancel := requestContext()
	defer cancel()
	card, err := h.service.Create(ctx, value)
	if err != nil {
		return respondError(c, err)
	}
	return c.Status(fiber.StatusCreated).JSON(card)
}

func (h *Handler) update(c fiber.Ctx) error {
	id, err := parseID(c)
	if err != nil {
		return respondError(c, err)
	}
	value, err := fields(c)
	if err != nil {
		return respondError(c, err)
	}
	ctx, cancel := requestContext()
	defer cancel()
	card, err := h.service.Update(ctx, id, value)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(card)
}

func (h *Handler) review(c fiber.Ctx) error {
	id, err := parseID(c)
	if err != nil {
		return respondError(c, err)
	}
	var body struct {
		NeedsReview *bool `json:"needsReview"`
	}
	if json.Unmarshal(c.Body(), &body) != nil || body.NeedsReview == nil {
		return respondError(c, domain.ErrInvalid)
	}
	ctx, cancel := requestContext()
	defer cancel()
	card, err := h.service.SetReview(ctx, id, *body.NeedsReview)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(card)
}

func (h *Handler) delete(c fiber.Ctx) error {
	id, err := parseID(c)
	if err != nil {
		return respondError(c, err)
	}
	ctx, cancel := requestContext()
	defer cancel()
	if err := h.service.Delete(ctx, id); err != nil {
		return respondError(c, err)
	}
	return c.SendStatus(fiber.StatusNoContent)
}

func (h *Handler) importCSV(c fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "กรุณาเลือกไฟล์ CSV"})
	}
	if file.Size > 5<<20 {
		return c.Status(fiber.StatusRequestEntityTooLarge).JSON(fiber.Map{"error": "ไฟล์ CSV ต้องไม่เกิน 5 MB"})
	}
	stream, err := file.Open()
	if err != nil {
		return respondError(c, err)
	}
	defer stream.Close()
	ctx, cancel := requestContext()
	defer cancel()
	result, err := h.service.Import(ctx, stream)
	if err != nil {
		return respondError(c, err)
	}
	return c.JSON(result)
}
