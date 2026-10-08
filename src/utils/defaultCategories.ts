// Categorias criadas automaticamente para cada novo usuário.
// Como as categorias agora pertencem a um usuário (e não são mais compartilhadas),
// cada conta nova recebe a sua própria cópia e pode editar/excluir à vontade.
export const DEFAULT_CATEGORIES: Array<{
  nome: string;
  tipo: "receita" | "despesa";
  icone: string;
  cor: string;
}> = [
  { nome: "Salário", tipo: "receita", icone: "wallet", cor: "#22C55E" },
  { nome: "Freelance", tipo: "receita", icone: "briefcase", cor: "#10B981" },
  { nome: "Investimentos", tipo: "receita", icone: "chart-line", cor: "#059669" },
  { nome: "Alimentação", tipo: "despesa", icone: "utensils", cor: "#F97316" },
  { nome: "Transporte", tipo: "despesa", icone: "car", cor: "#3B82F6" },
  { nome: "Lazer", tipo: "despesa", icone: "gamepad", cor: "#A855F7" },
];
