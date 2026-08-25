# Skill của dự án

Lấy từ [Claude Directory](https://www.claudedirectory.org/skills) rồi chỉnh theo
đúng dự án — thay ví dụ chung chung bằng tên file, lệnh npm và ràng buộc có thật
ở đây (quy tắc lịch sự khi thu thập, hạn mức 0,5 GB của Neon, ba extension bắt buộc).

| Skill | Nguồn | Dùng khi |
|---|---|---|
| [systematic-debugging](systematic-debugging/SKILL.md) | `/skills/superpowers-systematic-debugging` | Mọi trục trặc: test đỏ, probe không ra tin, lương sai, tin bị đóng nhầm |
| [regex-builder](regex-builder/SKILL.md) | `/skills/regex-builder` | Pattern đọc lương, cấp bậc, tỉnh thành, `sitemapUrlPattern` |
| [migrate-db](migrate-db/SKILL.md) | `/skills/migrate-db` | Sửa `prisma/schema.prisma`, bật extension, thêm cột vector |
| [sql-optimizer](sql-optimizer/SKILL.md) | `/skills/sql-optimizer` | pg_trgm khử trùng lặp chậm, tìm kiếm tiếng Việt, truy vấn pgvector, N+1 |

Claude tự chọn theo `description` trong frontmatter, hoặc gọi thẳng bằng tên:
`/systematic-debugging`, `/sql-optimizer`, …

## Cố ý không lấy

- **Code Review, Security Audit, Data Visualization** — Claude Code đã có sẵn
  `/code-review`, `/security-review`, `dataviz` với chất lượng cao hơn.
- **API Documentation Generator** — chưa có route API nào. Thêm khi dựng tầng web.
- **Test Generator** — repo đã có quy ước tốt hơn: 101 test trên fixture JSON-LD thật.
- **Playwright / Skyvern browser automation** — mâu thuẫn trực tiếp với quyết định
  kiến trúc ở [README](../../README.md#topcv--cần-anh-quyết): TopCV bị tắt vì
  không nguỵ trang dấu vân tay TLS. Trình duyệt tự động chính là con đường đó.
