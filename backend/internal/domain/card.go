package domain

import (
	"errors"
	"strings"
)

var (
	ErrInvalid   = errors.New("กรุณากรอกคำศัพท์ ชนิดของคำ และความหมาย")
	ErrDuplicate = errors.New("คำศัพท์และชนิดของคำนี้มีอยู่แล้ว")
	ErrNotFound  = errors.New("ไม่พบคำศัพท์")
)

type Card struct {
	ID           int64  `json:"id"`
	Word         string `json:"word"`
	PartOfSpeech string `json:"partOfSpeech"`
	Meaning      string `json:"meaning"`
	Hint         string `json:"hint"`
	NeedsReview  bool   `json:"needsReview"`
}

type Fields struct {
	Word         string `json:"word"`
	PartOfSpeech string `json:"partOfSpeech"`
	Meaning      string `json:"meaning"`
	Hint         string `json:"hint"`
}

func (f Fields) Clean() (Fields, error) {
	f.Word = strings.TrimSpace(f.Word)
	f.PartOfSpeech = strings.TrimSpace(f.PartOfSpeech)
	f.Meaning = strings.TrimSpace(f.Meaning)
	f.Hint = strings.TrimSpace(f.Hint)
	if f.Word == "" || f.PartOfSpeech == "" || f.Meaning == "" {
		return Fields{}, ErrInvalid
	}
	return f, nil
}
