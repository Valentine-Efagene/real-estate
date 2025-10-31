import { Column, Entity, JoinColumn, JoinTable, ManyToMany, ManyToOne, OneToMany, OneToOne } from 'typeorm';
import { Currency, PropertyCategory, PropertyType, Period } from './property.enums';
import { PropertyDocument } from '../property-document/property-document.entity';
import { PropertyMedia } from '../property-media/property-media.entity';
import { User } from '../user/user.entity';
import { Amenity } from '../amenity/amenity.entity';
import { AbstractBaseReviewableEntity } from '../common/common.entity';
import { Status } from '../common/common.type';

@Entity({ name: 'property' })
export class Property extends AbstractBaseReviewableEntity {
  @ManyToOne(() => User, {
    //eager: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ nullable: true })
  userId: number;

  @OneToMany(
    () => PropertyDocument,
    (propertyDocument) => propertyDocument.property,
  )
  documents: PropertyDocument[];

  @ManyToMany(() => Amenity)
  @JoinTable()
  amenities: Amenity[]

  @OneToMany(
    () => PropertyMedia,
    (propertyDocument) => propertyDocument.property,
  )

  media: PropertyMedia[];
  @OneToOne(() => PropertyMedia, {
    onDelete: 'SET NULL', // prevents FK errors if image is deleted
    onUpdate: 'CASCADE'
  })
  @JoinColumn({ name: 'display_image_id' })
  displayImage: PropertyMedia;

  @Column({
    nullable: true
  })
  displayImageId: number

  @Column({ nullable: true })
  title?: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: PropertyCategory
  })
  category: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: PropertyType
  })
  propertyType: string;

  @Column({
    nullable: true,
    type: 'enum',
    enum: Period
  })
  period: Period;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  zipCode: string;

  @Column({ default: false })
  streetAdress: string;

  @Column({ nullable: false })
  nBedrooms: string

  @Column({ nullable: false })
  nBathrooms: string

  @Column({ nullable: false })
  nParkingSpots: string

  @Column({
    nullable: false,
    type: 'enum',
    enum: Currency
  })
  currency: Currency

  // @Column({
  //   nullable: false,
  //   type: 'enum',
  //   enum: Period
  // })
  // period: Period

  @Column({
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  price: number

  @Column({
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  longitude: number

  @Column({
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  latitude: number

  @Column({
    type: 'double precision',
    scale: 2,
    precision: 20,
    nullable: true,
  })
  area: number

  @Column({
    type: 'text',
    nullable: true
  })
  description: string

  @Column({
    type: 'enum',
    enum: Status,
    default: Status.PENDING,
  })
  status: Status;
}
