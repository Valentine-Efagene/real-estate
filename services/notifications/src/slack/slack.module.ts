import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SlackController } from './slack.controller';
import SlackService from './slack.service';

@Module({
  imports: [HttpModule],
  controllers: [SlackController],
  providers: [SlackService],
  exports: [SlackService]
})

export class SlackModule { }
