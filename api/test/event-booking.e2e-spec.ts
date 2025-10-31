import * as dotenv from 'dotenv'

dotenv.config({ path: '.test.env' })

import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, HttpStatus } from '@nestjs/common'
import * as request from 'supertest'
import { AppModule } from '../src/app.module'
import { MailService } from '../src/mail/mail.service'
import { User } from '../src/user/user.entity'
import { getRepositoryToken } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { RoleSeeder } from '../src/role/role.seeder'
import { PermissionSeeder } from '../src/permission/permission.seeder'
import { SignInDto } from '../src/auth/auth.dto'
import { CreateUserDto } from '../src/user/user.dto'
import { UserService } from '../src/user/user.service'
import { mockMailService } from './__mocks__/mail.service.mock'
import { Event } from '../src/property/property.entity'
import { CreateEventControllerDto, SetDisplayImageDto } from '../src/property/property.dto'
import { faker } from '@faker-js/faker';
import { CreateOrderDto } from '../src/order/order.dto'
import { Currency, ResponseMessage } from '../src/common/common.enum'
import { EventTicketType } from '../src/event-ticket-type/event-ticket-type.entity'
import { CreateEventTicketTypeDto, UpdateEventTicketTypeDto } from '../src/event-ticket-type/event-ticket-type.dto'
import { Order } from '../src/order/order.entity'
import { Ticket } from '../src/ticket/ticket.entity'
import { TicketReassignmentDto } from '../src/ticket/ticket.dto'
import { EventTicketTypeStatus } from '../src/event-ticket-type/event-ticket-type.enum'
import { EventAuditLog } from '../src/event-audit-log/event-audit-log.entity'
import { S3UploaderService } from '../src/s3-uploader/s3-uploader.service'
import { mockS3UploaderService } from './__mocks__/s3-uploader.service.mock'
import * as path from 'path'
import { existsSync } from 'fs'
import { PropertyMedia } from 'src/property-media/property-media.entity'
import { StandardApiResponse } from 'src/common/common.dto'
import { Paginated } from 'nestjs-paginate'
import { PaystackService } from '../src/payment/paystack.service'
import { mockPaystackService } from './__mocks__/paystack.service.mock'

describe('AuthController (e2e)', () => {
  let app: INestApplication
  let userRepo: Repository<User>
  let staff: User
  let testUser: User
  let testUser2: User
  let event: Event
  let userService: UserService
  let staffToken: string
  let vipCategoryId: number
  let eventTicketType1: EventTicketType
  let userToken: string
  let user2Token: string
  let order: Order
  let eventAuditLogRepository: Repository<EventAuditLog>
  let eventRepository: Repository<Event>
  let tickets: Ticket[]
  let PropertyMedia: PropertyMedia[]
  let friend = {
    guestEmail: 'susannefriend@testmail.com',
    guestFirstName: 'Susanne',
    guestLastName: 'Friend'
  }

  const testUserDto = {
    email: 'testuser@example.com',
    password: 'Test@123',
    country: 'Nigeria',
    firstName: 'Test',
    lastName: 'User',
    gender: 'male'
  }

  const testUser2Dto = {
    email: 'testuser2@example.com',
    password: 'Test@123',
    country: 'Nigeria',
    firstName: 'Test',
    lastName: 'User2',
    gender: 'female'
  }

  const testStaffDto: CreateUserDto = {
    email: 'teststaff@example.com',
    password: 'Test@123',
    country: 'Nigeria',
    firstName: 'Test',
    lastName: 'Staff',
    roles: ['admin'],
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mockMailService)
      .overrideProvider(S3UploaderService)
      .useValue(mockS3UploaderService)
      .overrideProvider(PaystackService)
      .useValue(mockPaystackService)
      .compile()

    app = moduleFixture.createNestApplication()

    const roleSeeder = app.get(RoleSeeder)
    await roleSeeder.seed()

    const permissionSeeder = app.get(PermissionSeeder)
    await permissionSeeder.seed()

    // const ticketCategorySeeder = app.get(TicketCategorySeeder)
    // await ticketCategorySeeder.seed()

    await app.init()

    userService = moduleFixture.get<UserService>(UserService)
    userRepo = moduleFixture.get<Repository<User>>(getRepositoryToken(User))
    eventRepository = moduleFixture.get<Repository<Event>>(getRepositoryToken(Event))
    eventAuditLogRepository = moduleFixture.get<Repository<EventAuditLog>>(getRepositoryToken(EventAuditLog))

    // Authorization test is already handled in the app.e2e-spec.ts
    // so we can skip the seeding of test user here
    testUser = await userService.create(testUserDto)

    userRepo.update(testUser.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    })

    testUser2 = await userService.create(testUser2Dto)

    userRepo.update(testUser2.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    })

    staff = await userService.create(testStaffDto)

    userRepo.update(staff.id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    })
  })

  afterAll(async () => {
    await app.close()
  })

  it('Staff creates event', async () => {
    const dto: SignInDto = {
      identifier: staff.email,
      password: testStaffDto.password,
    }

    const authRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send(dto)

    staffToken = authRes.body.payload.accessToken

    const createEventDto: CreateEventControllerDto = {
      media: [],
      title: 'Test Event',
      streetAddress: faker.location.streetAddress(),
      city: faker.location.city(),
      zipCode: faker.location.zipCode(),
      state: faker.location.state(),
      country: faker.location.country(),
      isPrivate: true,
      description: faker.definitions.commerce.product_description[0],
      startsAt: faker.date.birthdate(),
      endsAt: faker.date.birthdate()
    }

    const res = await request(app.getHttpServer())
      .post(`/events`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(createEventDto)
      .expect(HttpStatus.CREATED)

    event = res.body.payload
  })

  it('logs the event creation', async () => {
    const logs = await eventAuditLogRepository.find({
      where: {
        eventId: event.id,
      },
    })
    expect(logs.length).toBe(1)
    expect(logs[0].action).toBe('CREATE')
  })

  it('can read sample.jpg', () => {
    const filePath = path.resolve(__dirname, '__fixtures__/sample.jpg');
    const exists = existsSync(filePath);
    expect(exists).toBe(true);
  });

  it('Staff uploads media to event', async () => {
    const filePath = path.resolve(__dirname, '__fixtures__/sample.jpg')

    const res = await request(app.getHttpServer())
      .post(`/events/${event.id}/media`)
      .set('Authorization', `Bearer ${staffToken}`)
      // .field('someExtraField', 'value')
      .attach('media', filePath)
      .attach('media', filePath)
      .expect(HttpStatus.CREATED);

    const media = res.body.payload;
    PropertyMedia = media
    expect(Array.isArray(media)).toBe(true);
    expect(media.length).toBe(2)
    expect(media[0]).toHaveProperty('url');
    expect(media[0]).toHaveProperty('mimeType');
    expect(media[0]).toHaveProperty('size');
  });

  it('Anyone can fetch paginated event media', async () => {
    const res = await request(app.getHttpServer())
      .get(`/events/${event.id}/media?page=1&limit=10`)
      .expect(HttpStatus.OK);

    expect(res.body.message).toBe(ResponseMessage.FETCHED);
    const data = res.body.payload;
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.length).toBe(2)
    if (data.data.length) {
      expect(data.data[0]).toHaveProperty('url');
      expect(data.data[0]).toHaveProperty('mimeType');
      expect(data.data[0]).toHaveProperty('size');
    }
  });

  it('can fetch one event media', async () => {
    const res = await request(app.getHttpServer())
      .get(`/event-media/1`)
      .expect(HttpStatus.OK)
  })

  it('can delete event media', async () => {
    const targetMedia = PropertyMedia[1]
    const response = await request(app.getHttpServer())
      .delete(`/event-media/${targetMedia.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(HttpStatus.OK)

    expect(response.body.message).toBe(ResponseMessage.DELETED)

    await request(app.getHttpServer())
      .get(`/event-media/${targetMedia.id}`)
      .expect(HttpStatus.NOT_FOUND)
  })

  it('set event display image', async () => {
    const targetMedia = PropertyMedia[0]
    const dto: SetDisplayImageDto = {
      PropertyMediaId: targetMedia.id
    }
    const response = await request(app.getHttpServer())
      .post(`/events/${event.id}/set-display-image`)
      .send(dto)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(HttpStatus.OK)

    expect(response.body.message).toBe(ResponseMessage.UPDATED)

    const updatedEvent = await eventRepository.findOne({
      where: {
        id: event.id
      },
      relations: ['displayImage']
    })

    expect(updatedEvent.displayImage.id).toBe(targetMedia.id)
  })

  it('Staff defines ticket kinds (VIP, Regular)', async () => {
    const vipKindRes = await request(app.getHttpServer())
      .post(`/ticket-categories`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'VIP', description: 'VIP access' })
      .expect(HttpStatus.CREATED)

    vipCategoryId = vipKindRes.body.payload.id
  })

  it('Anybody lists events', async () => {
    const response = await request(app.getHttpServer())
      .get(`/events/paginate`)
      .expect(HttpStatus.OK)

    const events: Event[] = response.body.payload.data
    expect(response.body.message).toBe(ResponseMessage.FETCHED)
    expect(events.length).toBe(1)
  })

  it('Staff sets price for ticket kinds in event', async () => {
    const dto: CreateEventTicketTypeDto = {
      eventId: event.id,
      maxTicketsPerUser: 5,
      template: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Ticket</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f7f7f7;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding: 2rem 0;">
    <tr>
      <td align="center">
        <table width="400" cellpadding="0" cellspacing="0" style="background: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;">
          <tr>
            <td style="padding: 1.5rem; background: #2c3e50; color: #fff; text-align: center;">
              <h2 style="margin: 0; font-size: 24px;">Your Event Ticket</h2>
            </td>
          </tr>

          <tr>
            <td style="padding: 1.5rem;">
              <p style="margin: 0 0 1rem;">Hello <strong>{{name}}</strong>,</p>
              <p style="margin: 0 0 1rem;">Thanks for registering! Below is your ticket barcode:</p>

              <div style="text-align: center; margin: 2rem 0;">
                <img src="{{qrCodeUrl}}" alt="Ticket Barcode" style="width: 80%; max-width: 150px;" />
              </div>

              <p style="font-size: 0.9rem; color: #7f8c8d; text-align: center;">
                Please bring this ticket or show it on your phone at the entrance.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 1rem; background: #ecf0f1; text-align: center;">
              <small style="color: #95a5a6;">&copy; 2025 MediaCraft. All rights reserved.</small>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      templateDraft: {
        "counters": {
          "u_column": 1,
          "u_row": 1,
          "u_content_html": 1
        },
        "body": {
          "id": "pNCeYZxrbT",
          "rows": [
            {
              "id": "p1ZiozMCsc",
              "cells": [
                1
              ],
              "columns": [
                {
                  "id": "Pq-CQwkWa_",
                  "contents": [
                    {
                      "id": "3Nda7SJdq2",
                      "type": "html",
                      "values": {
                        "html": "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n  <title>Your Ticket</title>\n</head>\n<body style=\"margin: 0; padding: 0; font-family: Arial, sans-serif; background: #f7f7f7;\">\n  <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"padding: 2rem 0;\">\n    <tr>\n      <td align=\"center\">\n        <table width=\"400\" cellpadding=\"0\" cellspacing=\"0\" style=\"background: #fff; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); overflow: hidden;\">\n          <tr>\n            <td style=\"padding: 1.5rem; background: #2c3e50; color: #fff; text-align: center;\">\n              <h2 style=\"margin: 0; font-size: 24px;\">Your Event Ticket</h2>\n            </td>\n          </tr>\n\n          <tr>\n            <td style=\"padding: 1.5rem;\">\n              <p style=\"margin: 0 0 1rem;\">Hello <strong>{{name}}</strong>,</p>\n              <p style=\"margin: 0 0 1rem;\">Thanks for registering! Below is your ticket barcode:</p>\n\n              <div style=\"text-align: center; margin: 2rem 0;\">\n                <img src=\"{{barcode}}\" alt=\"Ticket Barcode\" style=\"width: 80%; max-width: 150px;\" />\n              </div>\n\n              <p style=\"font-size: 0.9rem; color: #7f8c8d; text-align: center;\">\n                Please bring this ticket or show it on your phone at the entrance.\n              </p>\n            </td>\n          </tr>\n\n          <tr>\n            <td style=\"padding: 1rem; background: #ecf0f1; text-align: center;\">\n              <small style=\"color: #95a5a6;\">&copy; 2025 MediaCraft. All rights reserved.</small>\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>",
                        "displayCondition": null,
                        "_styleGuide": null,
                        "containerPadding": "10px",
                        "anchor": "",
                        "_meta": {
                          "htmlID": "u_content_html_1",
                          "htmlClassNames": "u_content_html"
                        },
                        "selectable": true,
                        "draggable": true,
                        "duplicatable": true,
                        "deletable": true,
                        "hideable": true,
                        "locked": false
                      }
                    }
                  ],
                  "values": {
                    "backgroundColor": "",
                    "padding": "0px",
                    "border": {},
                    "borderRadius": "0px",
                    "_meta": {
                      "htmlID": "u_column_1",
                      "htmlClassNames": "u_column"
                    },
                    "deletable": true,
                    "locked": false
                  }
                }
              ],
              "values": {
                "displayCondition": null,
                "columns": false,
                "_styleGuide": null,
                "backgroundColor": "",
                "columnsBackgroundColor": "",
                "backgroundImage": {
                  "url": "",
                  "fullWidth": true,
                  "repeat": "no-repeat",
                  "size": "custom",
                  "position": "center",
                  "customPosition": [
                    "50%",
                    "50%"
                  ]
                },
                "padding": "0px",
                "anchor": "",
                "hideDesktop": false,
                "_meta": {
                  "htmlID": "u_row_1",
                  "htmlClassNames": "u_row"
                },
                "selectable": true,
                "draggable": true,
                "duplicatable": true,
                "deletable": true,
                "hideable": true,
                "locked": false
              }
            }
          ],
          "headers": [],
          "footers": [],
          "values": {
            "_styleGuide": null,
            "popupPosition": "center",
            "popupWidth": "600px",
            "popupHeight": "auto",
            "borderRadius": "10px",
            "contentAlign": "center",
            "contentVerticalAlign": "center",
            "contentWidth": "500px",
            "fontFamily": {
              "label": "Arial",
              "value": "arial,helvetica,sans-serif"
            },
            "textColor": "#000000",
            "popupBackgroundColor": "#FFFFFF",
            "popupBackgroundImage": {
              "url": "",
              "fullWidth": true,
              "repeat": "no-repeat",
              "size": "cover",
              "position": "center"
            },
            "popupOverlay_backgroundColor": "rgba(0, 0, 0, 0.1)",
            "popupCloseButton_position": "top-right",
            "popupCloseButton_backgroundColor": "#DDDDDD",
            "popupCloseButton_iconColor": "#000000",
            "popupCloseButton_borderRadius": "0px",
            "popupCloseButton_margin": "0px",
            "popupCloseButton_action": {
              "name": "close_popup",
              "attrs": {
                "onClick": "document.querySelector('.u-popup-container').style.display = 'none';"
              }
            },
            "language": {},
            "backgroundColor": "#F7F8F9",
            "preheaderText": "",
            "linkStyle": {
              "body": true,
              "linkColor": "#0000ee",
              "linkHoverColor": "#0000ee",
              "linkUnderline": true,
              "linkHoverUnderline": true
            },
            "backgroundImage": {
              "url": "",
              "fullWidth": true,
              "repeat": "no-repeat",
              "size": "custom",
              "position": "center"
            },
            "_meta": {
              "htmlID": "u_body",
              "htmlClassNames": "u_body"
            }
          }
        },
        "schemaVersion": 21
      },
      ticketCategoryId: vipCategoryId,
      price: 10000,
      currency: Currency.NGN,
      capacity: 200
    }

    const ticketTypeRes = await request(app.getHttpServer())
      .post(`/event-ticket-types`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(dto)
      .expect(HttpStatus.CREATED)

    eventTicketType1 = ticketTypeRes.body.payload
  })

  it('User signs in', async () => {
    const userSignInRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({
        identifier: testUser.email,
        password: testUserDto.password,
      })

    userToken = userSignInRes.body.payload.accessToken

    const user2SignInRes = await request(app.getHttpServer())
      .post('/auth/sign-in')
      .send({
        identifier: testUser2.email,
        password: testUser2Dto.password,
      })

    user2Token = user2SignInRes.body.payload.accessToken
  })

  it('Cannot book an unactivated ticket type', async () => {
    const orderDto: CreateOrderDto = {
      userId: testUser.id,
      currency: Currency.USD,
      items: [
        {
          eventTicketTypeId: eventTicketType1.id,
          quantity: 2
        },
      ]
    }

    await request(app.getHttpServer())
      .post(`/orders`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(orderDto)
      .expect(HttpStatus.BAD_REQUEST)
      .expect(res => {
        expect(res.body.message).toMatch(/not available/i);
      })
  })

  it('Staff activates ticket type', async () => {
    const dto: UpdateEventTicketTypeDto = {
      status: EventTicketTypeStatus.ACTIVE,
    }

    await request(app.getHttpServer())
      .patch(`/event-ticket-types/${eventTicketType1.id}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send(dto)
      .expect(HttpStatus.OK)
      .expect(res => {
        expect(res.body.payload.status).toBe(EventTicketTypeStatus.ACTIVE)
      })
  })


  it('Cannot book more than the capacity of the ticket type', async () => {
    const EXCESS = 5

    const orderDto: CreateOrderDto = {
      userId: testUser.id,
      currency: Currency.USD,
      items: [
        {
          eventTicketTypeId: eventTicketType1.id,
          quantity: eventTicketType1.capacity + EXCESS // Exceeding capacity
        },
      ]
    }

    await request(app.getHttpServer())
      .post(`/orders`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(orderDto)
      .expect(HttpStatus.BAD_REQUEST)
      .expect(res => {
        expect(res.body.message).toMatch(/are available/i);
        expect(res.body.message).toBe(`Only ${eventTicketType1.capacity} VIP ticket(s) are available for this event.`);
      })
  })

  it('Cannot book an invalid ticket type', async () => {
    const orderDto: CreateOrderDto = {
      userId: testUser.id,
      currency: Currency.USD,
      items: [
        {
          eventTicketTypeId: 323, // Invalid ID
          quantity: 2
        },
      ]
    }

    await request(app.getHttpServer())
      .post(`/orders`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(orderDto)
      .expect(HttpStatus.BAD_REQUEST)
      .expect(res => {
        expect(res.body.message).toMatch(/not found/i);
      })
  })

  it('User books VIP tickets', async () => {
    const orderDto: CreateOrderDto = {
      userId: testUser.id,
      currency: Currency.NGN,
      items: [
        {
          eventTicketTypeId: eventTicketType1.id,
          quantity: 2
        },
      ]
    }

    const orderRes: { body: StandardApiResponse<{ paymentUrl: string }> } = await request(app.getHttpServer())
      .post(`/orders`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(orderDto)

    expect(orderRes.body.payload.paymentUrl).toBeTruthy()
  })

  it('User can load own orders', async () => {
    await request(app.getHttpServer())
      .get(`/orders/own`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(res => {
        const orders: StandardApiResponse<Paginated<Order>> = res.body
        expect(orders.payload.data.length).toBeGreaterThan(0)
        order = orders.payload.data?.[0]
      })

      .expect(HttpStatus.OK)
  })

  it('handle paystack webhook', async () => {
    await request(app.getHttpServer())
      .post(`/orders/paystack/webhook`)
      .send({
        event: 'charge.success',
        data: {
          id: 5218877442,
          domain: 'test',
          status: 'success',
          reference: `${order.id}`,
          amount: order.total,
          message: null,
          gateway_response: 'Successful',
          paid_at: '2025-08-08T05:37:10.000Z',
          created_at: '2025-08-08T05:37:03.000Z',
          channel: 'card',
          currency: 'NGN',
          ip_address: '102.88.115.178',
          metadata: { orderId: `${order.id}`, referrer: 'http://localhost:3200/' },
          fees_breakdown: null,
          log: null,
          fees: 40000,
          fees_split: null,
          authorization: {
            authorization_code: 'AUTH_h663hrh9vv',
            bin: '408408',
            last4: '4081',
            exp_month: '12',
            exp_year: '2030',
            channel: 'card',
            card_type: 'visa ',
            bank: 'TEST BANK',
            country_code: 'NG',
            brand: 'visa',
            reusable: true,
            signature: 'SIG_3b90rkS6yYStWSlNIMd9',
            account_name: null,
            receiver_bank_account_number: null,
            receiver_bank: null
          },
          customer: {
            id: testUser.id,
            first_name: null,
            last_name: null,
            email: testUser.email,
            customer_code: 'CUS_u1a934l8yvpqd8m',
            phone: null,
            metadata: null,
            risk_action: 'default',
            international_format_phone: null
          },
          plan: {},
          subaccount: {},
          split: {},
          order_id: null,
          paidAt: '2025-08-08T05:37:10.000Z',
          requested_amount: order.total,
          pos_transaction_data: null,
          source: {
            type: 'api',
            source: 'merchant_api',
            entry_point: 'transaction_initialize',
            identifier: null
          }
        }
      })
      .expect(HttpStatus.OK)
  })

  it('Ticket can be retrieved and has a QR code', async () => {
    await request(app.getHttpServer())
      .get(`/users/${testUser.id}/tickets`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(res => {
        tickets = res.body.payload.data
        expect(res.body.payload.data.length).toBe(2)
        const ticket = tickets[0] as Ticket
        expect(ticket.qrCodeImage).toBeDefined()
      })

      .expect(HttpStatus.OK)
  })

  it('Reassign the second ticket to a friend', async () => {
    const dto: TicketReassignmentDto = friend

    await request(app.getHttpServer())
      .post(`/tickets/${tickets?.[1].id}/reassign`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(dto)
      .expect(res => {
        const ticket: Ticket = res.body.payload
        expect(ticket.guestEmail).toBe(dto.guestEmail)
      })
      .expect(HttpStatus.OK)
  })

  it('Cannot reassign a ticket you dont own', async () => {
    const dto: TicketReassignmentDto = friend

    await request(app.getHttpServer())
      .post(`/tickets/${tickets?.[1].id}/reassign`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send(dto)
      .expect(res => {
        expect(res.body.message).toMatch(/not authorized/i)
      })
      .expect(HttpStatus.UNAUTHORIZED)
  })

  it('When retrieved again, one of the tickets has been reassigned', async () => {
    await request(app.getHttpServer())
      .get(`/users/${testUser.id}/tickets`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(res => {
        tickets = res.body.payload.data
        const exists = tickets.some(obj => obj.guestEmail === friend.guestEmail);
        expect(exists).toBe(true);
      })
      .expect(HttpStatus.OK)
  })
})
