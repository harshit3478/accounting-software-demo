import { PrismaClient } from "@prisma/client";
import { formatPaymentCode } from "../lib/payment-code";

const prisma = new PrismaClient();

async function main() {
  const batchSize = 500;
  let updatedCount = 0;

  while (true) {
    const payments = await prisma.payment.findMany({
      where: {
        paymentCode: null,
      },
      select: {
        id: true,
      },
      orderBy: {
        id: "asc",
      },
      take: batchSize,
    });

    if (payments.length === 0) {
      break;
    }

    await prisma.$transaction(
      payments.map((payment) =>
        prisma.payment.update({
          where: { id: payment.id },
          data: {
            paymentCode: formatPaymentCode(payment.id),
          },
        }),
      ),
    );

    updatedCount += payments.length;
    console.log(`Updated ${updatedCount} payment code(s)...`);
  }

  console.log(`Finished backfilling ${updatedCount} payment code(s).`);
}

main()
  .catch((error) => {
    console.error("Backfill payment codes failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
