export interface BotDefinition {
  id: string;
  name: string;
  description: string;
  tags?: string;
}

/**
 * Static registry of all bots in this app.
 * Add new bots here as they are created.
 */
export const BOT_REGISTRY: BotDefinition[] = [
  {
    id: "asana-chat",
    name: "Asana → Google Chat",
    description:
      "Detecta comentarios con #dir o @PowBoardBot en proyectos de Asana y los reenvía al Space del Directorio.",
    tags: process.env.FORWARD_TAGS ?? "#dir, @PowBoardBot",
  },
];
