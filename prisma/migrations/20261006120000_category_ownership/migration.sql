-- Existing shared categories remain available to every user, but are read-only.
-- New categories belong to their creator. No existing records are removed.
ALTER TABLE categorias ADD COLUMN id_usuario INTEGER NULL;
CREATE INDEX idx_categorias_usuario ON categorias(id_usuario);
ALTER TABLE categorias ADD CONSTRAINT categorias_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE ON UPDATE CASCADE;
