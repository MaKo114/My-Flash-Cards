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
	Merged  int           `json:"merged"`
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
	existing, err := s.repo.List(ctx)
	if err != nil {
		return result, err
	}
	byWord := make(map[string]domain.Card, len(existing))
	for _, card := range existing {
		byWord[strings.ToLower(card.Word)] = card
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
		fields := domain.Fields{
			Word:          record[0],
			PartsOfSpeech: strings.Split(record[1], ","),
			Meanings:      strings.Split(record[2], ","),
		}
		clean, cleanErr := fields.Clean()
		if cleanErr != nil {
			result.Invalid++
			result.Issues = append(result.Issues, ImportIssue{Row: row, Reason: "ข้อมูลไม่ครบ"})
			continue
		}
		old, exists := byWord[strings.ToLower(clean.Word)]
		if exists {
			parts, partsChanged := appendUnique(old.PartsOfSpeech, clean.PartsOfSpeech)
			meanings, meaningsChanged := appendUnique(old.Meanings, clean.Meanings)
			if !partsChanged && !meaningsChanged {
				result.Skipped++
				continue
			}
			updated, updateErr := s.Update(ctx, old.ID, domain.Fields{Word: old.Word, PartsOfSpeech: parts, Meanings: meanings, Hint: old.Hint})
			if updateErr != nil {
				return result, fmt.Errorf("import row %d: %w", row, updateErr)
			}
			byWord[strings.ToLower(clean.Word)] = updated
			result.Merged++
			continue
		}
		created, err := s.Create(ctx, clean)
		switch {
		case err == nil:
			byWord[strings.ToLower(clean.Word)] = created
			result.Added++
		case errors.Is(err, domain.ErrDuplicate):
			result.Skipped++
		default:
			return result, fmt.Errorf("import row %d: %w", row, err)
		}
	}
	return result, nil
}

func appendUnique(existing, incoming []string) ([]string, bool) {
	merged := append([]string(nil), existing...)
	seen := make(map[string]bool, len(existing))
	for _, value := range existing {
		seen[strings.ToLower(strings.TrimSpace(value))] = true
	}
	changed := false
	for _, value := range incoming {
		key := strings.ToLower(value)
		if !seen[key] {
			merged = append(merged, value)
			seen[key] = true
			changed = true
		}
	}
	return merged, changed
}
