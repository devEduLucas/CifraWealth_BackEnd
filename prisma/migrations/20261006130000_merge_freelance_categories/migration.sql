-- Merge only duplicate starter categories. Preserve all linked transactions.
START TRANSACTION;

UPDATE transacoes AS transaction_record
INNER JOIN categorias AS duplicate_category ON duplicate_category.id_categoria = transaction_record.id_categoria
INNER JOIN categorias AS canonical_category ON canonical_category.id_usuario IS NULL
  AND canonical_category.tipo = duplicate_category.tipo
  AND LOWER(TRIM(canonical_category.nome)) = 'freelance'
SET transaction_record.id_categoria = canonical_category.id_categoria,
    transaction_record.updated_at = CURRENT_TIMESTAMP
WHERE duplicate_category.id_usuario IS NULL
  AND LOWER(TRIM(duplicate_category.nome)) IN ('freelancer', 'freenlancer');

DELETE duplicate_category
FROM categorias AS duplicate_category
INNER JOIN categorias AS canonical_category ON canonical_category.id_usuario IS NULL
  AND canonical_category.tipo = duplicate_category.tipo
  AND LOWER(TRIM(canonical_category.nome)) = 'freelance'
WHERE duplicate_category.id_usuario IS NULL
  AND LOWER(TRIM(duplicate_category.nome)) IN ('freelancer', 'freenlancer');

COMMIT;
