package models

import "time"

type DocNode struct {
	ID        string    `json:"id"`
	ParentID  *string   `json:"parentId"`
	NodeType  string    `json:"nodeType"` // "group" | "doc"
	Title     string    `json:"title"`
	Expanded  bool      `json:"expanded"`
	SortOrder int       `json:"sortOrder"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type DocContent struct {
	DocID     string    `json:"docId"`
	Content   string    `json:"content"`
	UpdatedAt time.Time `json:"updatedAt"`
}
