/*
  Warnings:

  - A unique constraint covering the columns `[phaseId,order]` on the table `payment_method_phase_steps` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paymentMethodId,order]` on the table `property_payment_method_phases` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `payment_method_phase_steps_phaseId_order_key` ON `payment_method_phase_steps`(`phaseId`, `order`);

-- CreateIndex
CREATE UNIQUE INDEX `property_payment_method_phases_paymentMethodId_order_key` ON `property_payment_method_phases`(`paymentMethodId`, `order`);
