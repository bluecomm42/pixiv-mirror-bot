import logger from "../../common/logger.js";
import mirror from "../pixiv-mirror.js";
import client from "../../common/client.js";
import Bluebird from "bluebird";

import {
  alreadyReplied,
  buildComment,
  dedupe,
  myComment,
  regexBase,
} from "../../common/util.js";
import { Comment } from "snoowrap";

const commentRegex = new RegExp(regexBase, "g");

/**
 * Process a single comment.
 *
 * @param comment The comment to process.
 */
export default async function processComment(commentId: string): Promise<void> {
  // @ts-expect-error: Pending not-an-aardvark/snoowrap#221
  const comment: Comment = await client.getComment(commentId).fetch();

  // Ignore any comments made by this bot to avoid accidental loops.
  if (myComment(comment)) return;

  const log = logger.child({ comment: commentId });
  log.info("Processing comment");

  if (comment.archived) {
    log.info("Comment is archived, ignoring");
    return;
  }

  const matches = comment.body.matchAll(commentRegex);
  const foundIds = Array.from(matches, (m) => parseInt(m[1]));
  if (foundIds.length === 0) {
    log.info("Found no matches");
    return;
  }
  if (await alreadyReplied(comment)) {
    log.info("Already replied to comment");
    return;
  }

  const ids = dedupe(foundIds);
  log.info("Processing matches", { matches: ids });

  const albums = await Bluebird.resolve(ids)
    .map(mirror)
    .filter((e) => e != null);

  if (albums.length === 0) {
    log.info("No mirror(s) created");
    return;
  }

  const msg = buildComment(albums);
  // @ts-expect-error: Pending not-an-aardvark/snoowrap#221
  const reply = await comment.reply(msg);
  log.info("Successfuly replied to post", { replyId: reply.id });
}