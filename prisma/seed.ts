import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { DEFAULT_CATEGORIES } from "../src/utils/defaultCategories.js";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.usuarios.findMany({ select: { id_usuario: true } });

  for (const user of users) {
    for (const category of DEFAULT_CATEGORIES) {
      const exists = await prisma.categorias.findFirst({
        where: { id_usuario: user.id_usuario, nome: category.nome, tipo: category.tipo },
      });
      if (!exists) {
        await prisma.categorias.create({
          data: { ...category, id_usuario: user.id_usuario },
        });
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
