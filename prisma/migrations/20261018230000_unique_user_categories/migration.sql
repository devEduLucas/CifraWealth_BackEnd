-- Do not delete, rename or merge any existing category or financial record.
-- Existing duplicates must be reviewed before deployment; if present, MySQL
-- rejects creation of this index instead of modifying those records.
CREATE UNIQUE INDEX uq_categorias_usuario_nome_tipo ON categorias(id_usuario, nome, tipo);
