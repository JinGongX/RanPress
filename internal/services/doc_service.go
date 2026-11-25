package services

import (
	"changeme/internal/models"
	"database/sql"
	"errors"
)

type DocService struct {
	store *SuiStore
}

// 创建新的DocService实例
func NewDocService(store *SuiStore) *DocService {
	return &DocService{
		store: store,
	}
}

// 查询全部目录节点（按层级与排序返回，方便前端组装树/分组）
func (r *DocService) ListDocNodes() ([]models.DocNode, error) {
	rows, err := r.store.DB.Query(`
		SELECT id, parent_id, node_type, title, expanded, sort_order, created_at, updated_at
		FROM doc_nodes
		ORDER BY CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END, sort_order ASC, created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []models.DocNode
	for rows.Next() {
		var n models.DocNode
		var parentID sql.NullString
		var expandedInt int
		if err := rows.Scan(
			&n.ID,
			&parentID,
			&n.NodeType,
			&n.Title,
			&expandedInt,
			&n.SortOrder,
			&n.CreatedAt,
			&n.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if parentID.Valid {
			p := parentID.String
			n.ParentID = &p
		}
		n.Expanded = expandedInt != 0
		nodes = append(nodes, n)
	}
	return nodes, rows.Err()
}

// 根据id查询单个目录节点
func (r *DocService) GetDocNode(id string) (*models.DocNode, error) {
	row := r.store.DB.QueryRow(`
		SELECT id, parent_id, node_type, title, expanded, sort_order, created_at, updated_at
		FROM doc_nodes
		WHERE id = ?
	`, id)

	var n models.DocNode
	var parentID sql.NullString
	var expandedInt int
	err := row.Scan(
		&n.ID,
		&parentID,
		&n.NodeType,
		&n.Title,
		&expandedInt,
		&n.SortOrder,
		&n.CreatedAt,
		&n.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if parentID.Valid {
		p := parentID.String
		n.ParentID = &p
	}
	n.Expanded = expandedInt != 0
	return &n, nil
}

// 根据docId查询文章内容（不存在时返回空内容，避免前端报错）
func (r *DocService) GetDocContent(docID string) (*models.DocContent, error) {
	row := r.store.DB.QueryRow(`
		SELECT doc_id, content, updated_at
		FROM doc_contents
		WHERE doc_id = ?
	`, docID)

	var c models.DocContent
	err := row.Scan(&c.DocID, &c.Content, &c.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return &models.DocContent{
			DocID:   docID,
			Content: "",
		}, nil
	}
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// 新增目录节点（若为"doc"，同步初始化一条空内容记录）
func (r *DocService) CreateDocNode(id string, parentID *string, nodeType, title string, sortOrder int) error {
	tx, err := r.store.DB.Begin()
	if err != nil {
		return err
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	_, err = tx.Exec(`
		INSERT INTO doc_nodes (id, parent_id, node_type, title, expanded, sort_order)
		VALUES (?, ?, ?, ?, 1, ?)
	`, id, parentID, nodeType, title, sortOrder)
	if err != nil {
		return err
	}

	if nodeType == "doc" {
		_, err = tx.Exec(`
			INSERT INTO doc_contents (doc_id, content)
			VALUES (?, '')
			ON CONFLICT(doc_id) DO NOTHING
		`, id)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// 编辑目录节点名称/展开状态/排序/父节点
func (r *DocService) UpdateDocNode(id string, parentID *string, title string, expanded bool, sortOrder int) error {
	expInt := 0
	if expanded {
		expInt = 1
	}
	_, err := r.store.DB.Exec(`
		UPDATE doc_nodes
		SET parent_id = ?, title = ?, expanded = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, parentID, title, expInt, sortOrder, id)
	return err
}

// 快捷重命名目录节点（行内编辑标题时更轻量）
func (r *DocService) RenameDocNode(id, title string) error {
	_, err := r.store.DB.Exec(`
		UPDATE doc_nodes
		SET title = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, title, id)
	return err
}

// 新增或更新文章内容（自动保存/手动保存均可调用）
func (r *DocService) SaveDocContent(docID, content string) error {
	_, err := r.store.DB.Exec(`
		INSERT INTO doc_contents (doc_id, content, updated_at)
		VALUES (?, ?, CURRENT_TIMESTAMP)
		ON CONFLICT(doc_id) DO UPDATE SET
			content = excluded.content,
			updated_at = CURRENT_TIMESTAMP
	`, docID, content)
	return err
}

// 删除目录节点（依赖外键 ON DELETE CASCADE 自动清理子节点及对应正文）
func (r *DocService) DeleteDocNode(id string) error {
	_, err := r.store.DB.Exec(`
		DELETE FROM doc_nodes
		WHERE id = ?
	`, id)
	return err
}
