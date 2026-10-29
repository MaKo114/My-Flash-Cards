package application

import (
	"context"
	"errors"
	"strings"
	"testing"

	"my-flash-cards/backend/internal/domain"
)

type memoryRepo struct{ cards []domain.Card }

func (m *memoryRepo) List(context.Context) ([]domain.Card, error) { return m.cards, nil }
func (m *memoryRepo) Create(_ context.Context, fields domain.Fields) (domain.Card, error) {
	for _, card := range m.cards {
		if strings.EqualFold(card.Word, fields.Word) {
			return domain.Card{}, domain.ErrDuplicate
		}
	}
	card := domain.Card{ID: int64(len(m.cards) + 1), Word: fields.Word, PartOfSpeech: fields.PartOfSpeech, Meaning: fields.Meaning, PartsOfSpeech: fields.PartsOfSpeech, Meanings: fields.Meanings, Hint: fields.Hint}
	m.cards = append(m.cards, card)
	return card, nil
}
func (m *memoryRepo) Update(_ context.Context, id int64, fields domain.Fields) (domain.Card, error) {
	for index, card := range m.cards {
		if card.ID == id {
			card.Word, card.PartOfSpeech, card.Meaning = fields.Word, fields.PartOfSpeech, fields.Meaning
			card.PartsOfSpeech, card.Meanings, card.Hint = fields.PartsOfSpeech, fields.Meanings, fields.Hint
			m.cards[index] = card
			return card, nil
		}
	}
	return domain.Card{}, domain.ErrNotFound
}
func (*memoryRepo) SetReview(context.Context, int64, bool) (domain.Card, error) { panic("unused") }
func (*memoryRepo) Delete(context.Context, int64) error                         { panic("unused") }

func TestImportReportsDuplicatesAndInvalidRows(t *testing.T) {
	repo := &memoryRepo{}
	service := New(repo)
	input := "\ufeffคำศัพท์,ชนิดของคำ,ความหมาย\nRun,verb,วิ่ง\nrun,VERB,อีกความหมาย\nrun,noun,การวิ่ง\nrun,verb,วิ่ง\nbad,noun,\n\n\"two, words\",noun,สองคำ\nabout,\"verb, preposition\",\"ประมาณ, รอบๆ, เกี่ยวกับ\"\n"
	result, err := service.Import(context.Background(), strings.NewReader(input))
	if err != nil {
		t.Fatal(err)
	}
	if result.Added != 3 || result.Merged != 2 || result.Skipped != 1 || result.Invalid != 1 {
		t.Fatalf("unexpected summary: %#v", result)
	}
	if len(result.Issues) != 1 || result.Issues[0].Row != 6 {
		t.Fatalf("unexpected issues: %#v", result.Issues)
	}
	if repo.cards[1].Word != "Two, words" || len(repo.cards[2].PartsOfSpeech) != 2 || len(repo.cards[2].Meanings) != 3 {
		t.Fatalf("quoted fields were not parsed: %#v", repo.cards)
	}
	if len(repo.cards[0].PartsOfSpeech) != 2 || len(repo.cards[0].Meanings) != 3 {
		t.Fatalf("repeated word was not merged: %#v", repo.cards[0])
	}
}

func TestImportRequiresExactHeader(t *testing.T) {
	_, err := New(&memoryRepo{}).Import(context.Background(), strings.NewReader("word,type,meaning\nrun,verb,วิ่ง\n"))
	if !errors.Is(err, ErrCSVHeader) {
		t.Fatalf("expected ErrCSVHeader, got %v", err)
	}
}

func TestImportRejectsInvalidEncodingBeforeWriting(t *testing.T) {
	repo := &memoryRepo{}
	input := append([]byte("คำศัพท์,ชนิดของคำ,ความหมาย\nrun,verb,วิ่ง\n"), 0xff)
	_, err := New(repo).Import(context.Background(), strings.NewReader(string(input)))
	if !errors.Is(err, ErrCSVEncoding) || len(repo.cards) != 0 {
		t.Fatalf("expected no writes for invalid UTF-8, got %v and %#v", err, repo.cards)
	}
}

func TestCreateTrimsAndRejectsMissingFields(t *testing.T) {
	service := New(&memoryRepo{})
	card, err := service.Create(context.Background(), domain.Fields{Word: " run ", PartOfSpeech: " verb ", Meaning: " วิ่ง "})
	if err != nil || card.Word != "Run" || card.PartOfSpeech != "verb" || len(card.PartsOfSpeech) != 1 {
		t.Fatalf("unexpected card: %#v, %v", card, err)
	}
	_, err = service.Create(context.Background(), domain.Fields{Word: " ", PartOfSpeech: "noun", Meaning: "คำ"})
	if !errors.Is(err, domain.ErrInvalid) {
		t.Fatalf("expected ErrInvalid, got %v", err)
	}
	_, err = service.Create(context.Background(), domain.Fields{Word: "run", PartOfSpeech: "noun", Meaning: "การวิ่ง"})
	if !errors.Is(err, domain.ErrDuplicate) {
		t.Fatalf("expected ErrDuplicate, got %v", err)
	}
}
