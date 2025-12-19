import { Body, Controller, Get, Param, Post, ParseIntPipe } from '@nestjs/common';
import { MortgageDownpaymentService } from './mortgage-downpayment.service';
import { CreateDownpaymentPlanDto } from './dto/create-downpayment-plan.dto';
import { CreateDownpaymentPaymentDto } from './dto/create-payment.dto';

@Controller()
export class MortgageDownpaymentController {
    constructor(private service: MortgageDownpaymentService) { }

    @Post('mortgages/:id/downpayment-plans')
    async createPlan(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateDownpaymentPlanDto) {
        return this.service.createPlan(id, dto as any);
    }

    @Get('mortgages/:id/downpayment-plans')
    async getPlanByMortgage(@Param('id', ParseIntPipe) id: number) {
        return this.service.getPlanByMortgage(id);
    }

    @Post('downpayment-plans/:id/payments')
    async pay(@Param('id', ParseIntPipe) id: number, @Body() dto: CreateDownpaymentPaymentDto) {
        // for now payerId null (caller should provide auth in real implementation)
        return this.service.recordPayment(id, null, dto.amount, dto.providerReference);
    }
}

export default MortgageDownpaymentController;
