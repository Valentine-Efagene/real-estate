import { Controller, Post, Get, Param, Body, ParseIntPipe, UseGuards } from '@nestjs/common';
import { MortgageFSMService } from './mortgage-fsm.service';
import { MortgageEvent, MortgageFSMContext } from './mortgage-fsm.types';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

class TransitionDto {
    event: MortgageEvent;
    context?: Partial<MortgageFSMContext>;
    triggeredBy?: string;
}

@ApiTags('Mortgage FSM')
@Controller('mortgages/:id/fsm')
export class MortgageFSMController {
    constructor(private readonly fsmService: MortgageFSMService) {}

    @Post('transition')
    @ApiOperation({ summary: 'Trigger a state transition' })
    @ApiBody({ type: TransitionDto })
    @ApiResponse({ status: 200, description: 'Transition executed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid transition or failed guards' })
    async transition(
        @Param('id', ParseIntPipe) mortgageId: number,
        @Body() dto: TransitionDto
    ) {
        const result = await this.fsmService.transition(
            mortgageId,
            dto.event,
            dto.context || {},
            dto.triggeredBy || 'api'
        );

        return result;
    }

    @Get('state')
    @ApiOperation({ summary: 'Get current state and possible transitions' })
    async getCurrentState(@Param('id', ParseIntPipe) mortgageId: number) {
        // This would fetch from the mortgage repo in a real implementation
        return {
            mortgageId,
            // Implementation would load current state from DB
        };
    }

    @Get('history')
    @ApiOperation({ summary: 'Get state transition history' })
    async getHistory(@Param('id', ParseIntPipe) mortgageId: number) {
        const history = await this.fsmService.getHistory(mortgageId);
        return {
            mortgageId,
            history,
        };
    }

    @Get('possible-transitions/:state')
    @ApiOperation({ summary: 'Get possible transitions from a state' })
    async getPossibleTransitions(@Param('state') state: string) {
        const transitions = this.fsmService.getPossibleTransitions(state as any);
        return {
            state,
            possibleTransitions: transitions,
        };
    }
}

export default MortgageFSMController;
