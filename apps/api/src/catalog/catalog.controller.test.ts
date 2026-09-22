import { describe, expect, it, vi } from 'vitest';
import { CatalogController } from './catalog.controller';

function controllerWith(playerRow: { id: string } | null) {
  const prisma = {
    player: {
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        if (!playerRow || playerRow.id !== where.id) throw new Error('P2025: record not found');
        return playerRow;
      }),
    },
  };
  const notifications = { notify: vi.fn() };
  const controller = new CatalogController(prisma as never, notifications as never);
  return { controller, prisma };
}

describe('CatalogController.deletePlayer', () => {
  it('deletes the player and reports success', async () => {
    const { controller, prisma } = controllerWith({ id: 'p1' });
    await expect(controller.deletePlayer('p1')).resolves.toEqual({ deleted: true });
    expect(prisma.player.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('reports 404 for a player that does not exist', async () => {
    const { controller } = controllerWith(null);
    await expect(controller.deletePlayer('missing')).rejects.toMatchObject({
      status: 404,
      code: 'PLAYER_NOT_FOUND',
    });
  });
});
