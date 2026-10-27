package application

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strings"
	"unicode/utf8"

	"my-flash-cards/backend/internal/domain"
)

type Repository interface {
	List(context.Context) ([]domain.Card, error)
	Create(context.Context, domain.Fields) (domain.Card, error)
	Update(context.Context, int64, domain.Fields) (domain.Card, error)
	SetReview(context.Context, int64, bool) (domain.Card, error)
	Delete(context.Context, int64) error
}

type Service struct{ repo Repository }

func New(repo Repository) *Service { return &Service{repo: repo} }

func (s *Service) List(ctx context.Context) ([]domain.Card, error) { return s.repo.List(ctx) }

func (s *Service) Create(ctx context.Context, fields domain.Fields) (domain.Card, error) {
	clean, err := fields.Clean()
	if err != nil {
		return domain.Card{}, err
	}
	return s.repo.Create(ctx, clean)
}

func (s *Service) Update(ctx context.Context, id int64, fields domain.Fields) (domain.Card, error) {
	clean, err := fields.Clean()
	if err != nil {
		return domain.Card{}, err
	}
	return s.repo.Update(ctx, id, clean)
}

func (s *Service) SetReview(ctx context.Context, id int64, value bool) (domain.Card, error) {
	return s.repo.SetReview(ctx, id, value)
}

func (s *Service) Delete(ctx context.Context, id int64) error { return s.repo.Delete(ctx, id) }

type ImportIssue struct {
	Row    int    `json:"row"`
	Reason string `json:"reason"`
}

type ImportResult struct {
	Added   int           `json:"added"`
	Skipped int           `json:"skipped"`
	Invalid int           `json:"invalid"`
	Issues  []ImportIssue `json:"issues"`
}

var ErrCSVHeader = errors.New("CSV ต้องมีหัวคอลัมน์ คำศัพท์,ชนิดของคำ,ความหมาย ตามลำดับ")
var ErrCSVEncoding = errors.New("CSV ต้องเข้ารหัสแบบ UTF-8")

func (s *Service) Import(ctx context.Context, input io.Reader) (ImportResult, error) {
	result := ImportResult{Issues: []ImportIssue{}}
	raw, err := io.ReadAll(input)
	if err != nil {
		return result, err
	}
	if !utf8.Valid(raw) {
		return result, ErrCSVEncoding
	}
	reader := csv.NewReader(bytes.NewReader(raw))
	reader.FieldsPerRecord = -1
	header, err := reader.Read()
	if err != nil {
		return result, ErrCSVHeader
	}
	if len(header) != 3 {
		return result, ErrCSVHeader
	}
	header[0] = strings.TrimPrefix(header[0], "\ufeff")
	want := []string{"คำศัพท์", "ชนิดของคำ", "ความหมาย"}
	for i := range want {
		if strings.TrimSpace(header[i]) != want[i] {
			return result, ErrCSVHeader
		}
	}
	for row := 2; ; row++ {
		record, readErr := reader.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			result.Invalid++
			result.Issues = append(result.Issues, ImportIssue{Row: row, Reason: "รูปแบบ CSV ไม่ถูกต้อง"})
			continue
		}
		if len(record) == 1 && strings.TrimSpace(record[0]) == "" {
			continue
		}
		if len(record) != 3 {
			result.Invalid++
			result.Issues = append(result.Issues, ImportIssue{Row: row, Reason: "ต้องมีข้อมูล 3 คอลัมน์"})
			continue
		}
		_, err = s.Create(ctx, domain.Fields{Word: record[0], PartOfSpeech: record[1], Meaning: record[2]})
		switch {
		case err == nil:
			result.Added++
		case errors.Is(err, domain.ErrDuplicate):
			result.Skipped++
		case errors.Is(err, domain.ErrInvalid):
			result.Invalid++
			result.Issues = append(result.Issues, ImportIssue{Row: row, Reason: "ข้อมูลไม่ครบ"})
		default:
			return result, fmt.Errorf("import row %d: %w", row, err)
		}
	}
	return result, nil
}
