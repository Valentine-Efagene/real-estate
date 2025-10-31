import { Repository } from 'typeorm';
import { Settings } from './settings.entity';

export class SettingsRepository extends Repository<Settings> {
  // ...
}
