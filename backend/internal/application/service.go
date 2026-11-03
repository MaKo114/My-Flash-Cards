package application

import (
	"bytes"
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"
	"unicode/utf8"

	"my-flash-cards/backend/internal/domain"
)

type Repository interface {
	List(context.Context) ([]domain.Card, error)
	Create(context.Context, domain.Fields) (domain.Card, error)
	Update(context.Context, int64, domain.Fields) (domain.Card, error)
	ApplyImport(context.Context, []domain.ImportWrite) error
	SetReview(context.Context, int64, bool) (domain.Card, error)
	Delete(context.Context, int64) error
	RecordAnswer(context.Context, int64, bool, time.Time) (domain.Card, error)
	StudyDays(context.Context) ([]domain.StudyDay, error)
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

// Answer records a challenge answer given on the learner's local day (YYYY-MM-DD).
func (s *Service) Answer(ctx context.Context, id int64, correct bool, day string) (domain.Card, error) {
	today, err := domain.ParseDay(day, time.Now())
	if err != nil {
		return domain.Card{}, err
	}
	return s.repo.RecordAnswer(ctx, id, correct, today)
}

func (s *Service) StudyDays(ctx context.Context) ([]domain.StudyDay, error) {
	return s.repo.StudyDays(ctx)
}

type ImportIssue struct {
	Row    int    `json:"row"`
	Word   string `json:"word,omitempty"`
	Kind   string `json:"kind"`
	Reason string `json:"reason"`
}

type ImportResult struct {
	Added   int           `json:"added"`
	Merged  int           `json:"merged"`
	Skipped int           `json:"skipped"`
	Invalid int           `json:"invalid"`
	Issues  []ImportIssue `json:"issues"`
}

var ErrCSVHeader = errors.New("CSV ต้องมีหัวคอลัมน์ คำศัพท์,ชนิดของคำ,ความหมาย ตามลำดับ (เพิ่ม คำใบ้,ตัวอย่างประโยค ต่อท้ายได้)")
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
	reader.TrimLeadingSpace = true
	header, err := reader.Read()
	if err != nil {
		return result, ErrCSVHeader
	}
	// The short format lets meanings spill over unquoted commas; the full format (from export) has fixed columns.
	full := len(header) == 5
	if len(header) != 3 && !full {
		return result, ErrCSVHeader
	}
	header[0] = strings.TrimPrefix(header[0], "\ufeff")
	want := []string{"คำศัพท์", "ชนิดของคำ", "ความหมาย", "คำใบ้", "ตัวอย่างประโยค"}[:len(header)]
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
	writes := make(map[string]domain.ImportWrite)
	var writeOrder []string
	for row := 2; ; row++ {
		record, readErr := reader.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			result.Invalid++
			result.Issues = append(result.Issues, ImportIssue{Row: row, Word: importWord(record), Kind: "invalid", Reason: "รูปแบบ CSV ไม่ถูกต้อง"})
			continue
		}
		if len(record) == 1 && strings.TrimSpace(record[0]) == "" {
			continue
		}
		if len(record) < 3 || (full && len(record) != 5) {
			result.Invalid++
			result.Issues = append(result.Issues, ImportIssue{Row: row, Word: importWord(record), Kind: "invalid", Reason: fmt.Sprintf("ต้องมีข้อมูล %d คอลัมน์", len(header))})
			continue
		}
		fields := domain.Fields{
			Word:          record[0],
			PartsOfSpeech: strings.Split(record[1], ","),
			Meanings:      strings.Split(strings.Join(record[2:], ","), ","),
		}
		if full {
			fields.Meanings = strings.Split(record[2], ",")
			fields.Hint, fields.Example = record[3], record[4]
		}
		clean, cleanErr := fields.Clean()
		if cleanErr != nil {
			result.Invalid++
			result.Issues = append(result.Issues, ImportIssue{Row: row, Word: importWord(record), Kind: "invalid", Reason: importInvalidReason(record, full)})
			continue
		}
		key := strings.ToLower(clean.Word)
		old, exists := byWord[key]
		if exists {
			parts, partsChanged := appendUnique(old.PartsOfSpeech, clean.PartsOfSpeech)
			meanings, meaningsChanged := appendUnique(old.Meanings, clean.Meanings)
			if !partsChanged && !meaningsChanged {
				result.Skipped++
				result.Issues = append(result.Issues, ImportIssue{Row: row, Word: clean.Word, Kind: "skipped", Reason: "ข้อมูลของคำนี้มีอยู่แล้ว"})
				continue
			}
			fields, cleanErr := (domain.Fields{Word: old.Word, PartsOfSpeech: parts, Meanings: meanings, Hint: old.Hint, Example: old.Example}).Clean()
			if cleanErr != nil {
				return result, fmt.Errorf("import row %d: %w", row, cleanErr)
			}
			old.PartOfSpeech, old.Meaning = fields.PartOfSpeech, fields.Meaning
			old.PartsOfSpeech, old.Meanings = fields.PartsOfSpeech, fields.Meanings
			byWord[key] = old
			if _, queued := writes[key]; !queued {
				writeOrder = append(writeOrder, key)
			}
			writes[key] = domain.ImportWrite{ID: old.ID, Fields: fields}
			result.Merged++
			continue
		}
		byWord[key] = domain.Card{Word: clean.Word, PartOfSpeech: clean.PartOfSpeech, Meaning: clean.Meaning, PartsOfSpeech: clean.PartsOfSpeech, Meanings: clean.Meanings}
		writes[key] = domain.ImportWrite{Fields: clean}
		writeOrder = append(writeOrder, key)
		result.Added++
	}
	if len(writeOrder) > 0 {
		ordered := make([]domain.ImportWrite, 0, len(writeOrder))
		for _, key := range writeOrder {
			ordered = append(ordered, writes[key])
		}
		if err := s.repo.ApplyImport(ctx, ordered); err != nil {
			return result, err
		}
	}
	return result, nil
}

func importWord(record []string) string {
	if len(record) == 0 {
		return ""
	}
	return strings.TrimSpace(record[0])
}

func importInvalidReason(record []string, full bool) string {
	meanings := record[2:]
	if full {
		meanings = record[2:3]
	}
	if strings.TrimSpace(record[0]) == "" {
		return "ไม่มีคำศัพท์"
	}
	for _, part := range strings.Split(record[1], ",") {
		if strings.TrimSpace(part) == "" {
			return "ไม่มีชนิดของคำ"
		}
	}
	for _, meaning := range strings.Split(strings.Join(meanings, ","), ",") {
		if strings.TrimSpace(meaning) == "" {
			return "ไม่มีความหมาย"
		}
	}
	return "ข้อมูลไม่ครบ"
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
