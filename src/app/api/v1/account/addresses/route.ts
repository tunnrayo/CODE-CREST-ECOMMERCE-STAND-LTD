import { requireUser } from "@/server/auth/current";
import { ok, readJson, route } from "@/server/http";
import { addAddress, listAddresses } from "@/server/services/accounts";

export const dynamic = "force-dynamic";

/** GET /api/v1/account/addresses */
export const GET = route(async () => ok(await listAddresses((await requireUser()).id)));
/** POST /api/v1/account/addresses */
export const POST = route(async (req) => ok(await addAddress((await requireUser()).id, (await readJson(req)) as never), { status: 201 }));
