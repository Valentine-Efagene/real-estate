import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Permission, Role } from '@valentine-efagene/qshelter-common';
import { In, Repository } from 'typeorm';
import { PermissionName } from './permission.enums';
import { PERMISSIONS } from './permissions.data';

@Injectable()
export class PermissionSeeder {
    private readonly logger = new Logger(PermissionSeeder.name);

    constructor(
        @InjectRepository(Permission)
        private readonly permissionRepository: Repository<Permission>,

        @InjectRepository(Role)
        private readonly roleRepository: Repository<Role>,
    ) { }

    async seed() {
        const permissionsToSeed: Record<string, PermissionName[]> = PERMISSIONS

        const roles = Object.keys(permissionsToSeed);

        for (const roleName of roles) {
            const role = await this.roleRepository.findOne({ where: { name: roleName } });
            if (!role) {
                const permissionNames = permissionsToSeed[roleName];
                const permissionEntities = permissionNames.map(permissionName => this.permissionRepository.create({ name: permissionName }));
                await this.permissionRepository.save(permissionEntities);
                const newRole = this.roleRepository.create({ name: roleName, permissions: permissionEntities });
                await this.roleRepository.save(newRole);
                this.logger.log(`Seeded permissions for role: ${roleName}`);
            } else {
                const permissionNames = permissionsToSeed[roleName]
                for (const name of permissionNames) {
                    const existing = await this.permissionRepository.findOne({ where: { name } });
                    if (!existing) {
                        await this.permissionRepository.save(this.permissionRepository.create({ name }));
                    }
                }

                const permissionEntities = await this.permissionRepository.findBy({
                    name: In(permissionNames),
                });

                role.permissions = permissionEntities;
                await this.roleRepository.save(role);
                this.logger.log(`Updated permissions for role: ${roleName}`);
            }
        }
    }
}
