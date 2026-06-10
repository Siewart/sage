import { z } from "zod";

export const wordlist = z.object({
  word_list: z
    .array(
      z.object({
        name: z.string(),
        item: z.array(z.string()).nonempty(),
      }),
    )
    .nonempty(),
});
