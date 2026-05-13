import { z } from "zod";
import { plans, projectBalance } from "@/lib/store";

const Body = z.object({
  monthlyContribution: z.number().positive(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const plan = plans[id];
  if (!plan) {
    return Response.json({ error: `Plan "${id}" not found` }, { status: 404 });
  }

  let body;
  try {
    body = Body.parse(await request.json());
  } catch {
    return Response.json(
      { error: "monthlyContribution must be a positive number" },
      { status: 400 },
    );
  }

  const years = plan.targetYear - new Date().getFullYear();
  const projected = projectBalance(
    plan.currentBalance,
    body.monthlyContribution,
    plan.assumedReturn,
    years,
  );
  const prob = Math.min(
    99,
    Math.max(10, Math.round(50 + (projected / plan.targetBalance) * 40)),
  );
  const income = Math.round((projected * 0.04) / 12);

  return Response.json({
    monthlyContribution: body.monthlyContribution,
    projectedBalance: projected,
    successProbability: prob,
    monthlyIncomeAtRetirement: income,
  });
}
