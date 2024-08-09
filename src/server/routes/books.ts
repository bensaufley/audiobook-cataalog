import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { basename } from 'node:path';
import { Op } from 'sequelize';

import Audiobook from '~db/models/Audiobook';

type BookRequest = FastifyRequest<{
  Params: { id: string };
}>;

const books: FastifyPluginAsync = async (fastify, _opts) => {
  fastify.get('/', async ({ log, user }, res) => {
    log.debug('user: %o', user);
    const audiobooks = await Audiobook.findAll({
      attributes: ['id', 'title', 'createdAt', 'duration'],
      include: [
        Audiobook.associations.Authors,
        Audiobook.associations.Narrators,
        ...(user
          ? [{ association: Audiobook.associations.UserAudiobooks, where: { userId: user?.id }, required: false }]
          : []),
      ],
      order: [
        [Audiobook.associations.Authors, 'lastName', 'ASC'],
        [Audiobook.associations.Authors, 'firstName', 'ASC'],
        ['title', 'ASC'],
      ],

      logging: (...args) => fastify.log.debug(...args),
    });
    await res.send(audiobooks);
  });

  fastify.get('/:id', async ({ params: { id } }: BookRequest, res) => {
    const book = await Audiobook.findOne({
      attributes: ['id', 'title', 'createdAt', 'duration'],
      include: [Audiobook.associations.Authors, Audiobook.associations.Narrators],
      where: { id },
    });

    if (book === null) {
      await res.status(404).send({});
      return;
    }

    await res.send(book);
  });

  fastify.get('/:id/cover', async ({ params: { id } }: BookRequest, res) => {
    const book = (await Audiobook.findOne({
      attributes: ['cover', 'coverType'],
      where: { id, cover: { [Op.ne]: null } },
    })) as Audiobook<true> | null;

    if (book === null) {
      await res.status(404).send({});
      return;
    }

    res.header('Cache-Control', 'public, max-age=31536000');
    res.header('Content-Type', book.coverType);
    await res.send(book.cover);
  });

  fastify.get('/:id/download', async ({ params: { id } }: BookRequest, res) => {
    const book = await Audiobook.findOne({ attributes: ['filepath'], where: { id } });

    if (book === null) {
      await res.status(404);
      return;
    }

    const filename = basename(book.filepath);
    await res.header('Content-Disposition', `attachment; filename="${filename}"`).sendFile(book.filepath, '/');
  });
};

export default books;
