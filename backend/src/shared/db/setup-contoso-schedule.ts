import 'reflect-metadata';
import { getDataSource } from './data-source';
import { User } from '../models/User';
import { Team } from '../models/Team';
import { TeamMembership } from '../models/TeamMembership';
import { Schedule } from '../models/Schedule';
import { ScheduleLayer } from '../models/ScheduleLayer';
import { ScheduleLayerMember } from '../models/ScheduleLayerMember';
import { Service } from '../models/Service';

async function setupContosoSchedule() {
  console.log('Setting up Contoso team schedule...');

  const dataSource = await getDataSource();

  try {
    // 1. Find the user
    const userRepo = dataSource.getRepository(User);
    const user = await userRepo.findOne({
      where: { email: 'admin@example.com' }
    });

    if (!user) {
      console.error('User admin@example.com not found');
      process.exit(1);
    }

    console.log(`Found user: ${user.fullName} (org: ${user.orgId})`);

    // 2. Find the contoso team (case-insensitive)
    const teamRepo = dataSource.getRepository(Team);
    const teams = await teamRepo
      .createQueryBuilder('team')
      .where('team.orgId = :orgId', { orgId: user.orgId })
      .andWhere('LOWER(team.name) = LOWER(:name)', { name: 'contoso' })
      .getMany();

    const team = teams[0];
    if (!team) {
      console.error('Team "contoso" not found in org');
      process.exit(1);
    }

    console.log(`Found team: ${team.name} (id: ${team.id})`);

    // 3. Get team members
    const teamMemberRepo = dataSource.getRepository(TeamMembership);
    const teamMembers = await teamMemberRepo.find({
      where: { teamId: team.id },
      relations: ['user']
    });

    if (teamMembers.length === 0) {
      console.error('No members in contoso team');
      process.exit(1);
    }

    console.log(`Found ${teamMembers.length} team members:`);
    teamMembers.forEach((tm, i) => {
      console.log(`  ${i + 1}. ${tm.user.fullName} (${tm.user.email})`);
    });

    // 4. Create or update the schedule
    const scheduleRepo = dataSource.getRepository(Schedule);
    let schedule = await scheduleRepo.findOne({
      where: { orgId: user.orgId, teamId: team.id }
    });

    if (!schedule) {
      schedule = scheduleRepo.create({
        orgId: user.orgId,
        teamId: team.id,
        name: 'Contoso On-Call',
        description: '2 days on, rotating schedule for Contoso team',
        type: 'weekly', // Will be overridden by layer
        timezone: 'America/New_York'
      });
      await scheduleRepo.save(schedule);
      console.log(`Created schedule: ${schedule.name}`);
    } else {
      console.log(`Using existing schedule: ${schedule.name}`);
    }

    // 5. Create or update the schedule layer
    const layerRepo = dataSource.getRepository(ScheduleLayer);

    // Delete existing layers for this schedule
    await layerRepo.delete({ scheduleId: schedule.id });

    const layer = layerRepo.create({
      scheduleId: schedule.id,
      name: '2-Day Rotation',
      rotationType: 'custom',
      startDate: new Date(), // Start from today
      handoffTime: '09:00:00',
      rotationLength: 2, // 2 days per person
      layerOrder: 0
    });
    await layerRepo.save(layer);
    console.log(`Created layer: ${layer.name} (2-day rotation)`);

    // 6. Add team members to the layer
    const layerMemberRepo = dataSource.getRepository(ScheduleLayerMember);

    for (let i = 0; i < teamMembers.length; i++) {
      const tm = teamMembers[i];
      const layerMember = layerMemberRepo.create({
        layerId: layer.id,
        userId: tm.userId,
        position: i
      });
      await layerMemberRepo.save(layerMember);
      console.log(`  Added ${tm.user.fullName} at position ${i}`);
    }

    // 7. Link services to this schedule
    const serviceRepo = dataSource.getRepository(Service);
    const services = await serviceRepo.find({
      where: { orgId: user.orgId }
    });

    if (services.length > 0) {
      console.log(`\nLinking ${services.length} services to schedule:`);
      for (const service of services) {
        service.scheduleId = schedule.id;
        await serviceRepo.save(service);
        console.log(`  Linked: ${service.name}`);
      }
    }

    console.log('\n✅ Setup complete!');
    console.log(`Schedule: ${schedule.name}`);
    console.log(`Rotation: 2 days per person, starting from today at 9:00 AM`);
    console.log(`Members in rotation order:`);
    teamMembers.forEach((tm, i) => {
      const daysFromNow = i * 2;
      console.log(`  ${i + 1}. ${tm.user.fullName} - Days ${daysFromNow + 1}-${daysFromNow + 2}`);
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

setupContosoSchedule();
