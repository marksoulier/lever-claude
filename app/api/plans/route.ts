import { plans } from "@/lib/store";

export async function GET() {
  return Response.json(Object.values(plans));
}
