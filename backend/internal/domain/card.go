package domain

import (
	"errors"
	"strings"
	"unicode"
)

var (
	ErrInvalid   = errors.New("กรุณากรอกคำศัพท์ ชนิดของคำ และความหมาย")
	ErrDuplicate = errors.New("คำศัพท์นี้มีอยู่แล้ว กรุณาแก้ไขบัตรเดิมเพื่อเพิ่มชนิดหรือความหมาย")
	ErrNotFound  = errors.New("ไม่พบคำศัพท์")
)

type Card struct {
	ID            int64    `json:"id"`
	Word          string   `json:"word"`
	PartOfSpeech  string   `json:"partOfSpeech"`
	Meaning       string   `json:"meaning"`
	PartsOfSpeech []string `json:"partsOfSpeech"`
	Meanings      []string `json:"meanings"`
	Hint          string   `json:"hint"`
	NeedsReview   bool     `json:"needsReview"`
}

type Fields struct {
	Word          string   `json:"word"`
	PartOfSpeech  string   `json:"partOfSpeech"`
	Meaning       string   `json:"meaning"`
	PartsOfSpeech []string `json:"partsOfSpeech"`
	Meanings      []string `json:"meanings"`
	Hint          string   `json:"hint"`
}

func (f Fields) Clean() (Fields, error) {
	f.Word = strings.TrimSpace(f.Word)
	f.Hint = strings.TrimSpace(f.Hint)
	if len(f.PartsOfSpeech) == 0 && f.PartOfSpeech != "" {
		f.PartsOfSpeech = []string{f.PartOfSpeech}
	}
	if len(f.Meanings) == 0 && f.Meaning != "" {
		f.Meanings = []string{f.Meaning}
	}
	var valid bool
	f.PartsOfSpeech, valid = cleanList(f.PartsOfSpeech)
	if !valid {
		return Fields{}, ErrInvalid
	}
	f.Meanings, valid = cleanList(f.Meanings)
	if !valid || f.Word == "" {
		return Fields{}, ErrInvalid
	}
	f.PartOfSpeech = strings.Join(f.PartsOfSpeech, ", ")
	f.Meaning = strings.Join(f.Meanings, ", ")
	letters := []rune(f.Word)
	letters[0] = unicode.ToUpper(letters[0])
	f.Word = string(letters)
	return f, nil
}

func cleanList(values []string) ([]string, bool) {
	if len(values) == 0 {
		return nil, false
	}
	clean := make([]string, 0, len(values))
	seen := make(map[string]bool, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			return nil, false
		}
		key := strings.ToLower(value)
		if !seen[key] {
			clean = append(clean, value)
			seen[key] = true
		}
	}
	return clean, true
}
