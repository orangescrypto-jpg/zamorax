"use client"
import { useFormContext } from "react-hook-form"
import { PhonesAttr } from "./Step3Attributes/PhonesAttr"
import { ComputingAttr } from "./Step3Attributes/ComputingAttr"
import { ElectronicsAttr } from "./Step3Attributes/ElectronicsAttr"
import { FashionAttr } from "./Step3Attributes/FashionAttr"
import { HomeOfficeAttr } from "./Step3Attributes/HomeOfficeAttr"
import { HealthBeautyAttr } from "./Step3Attributes/HealthBeautyAttr"
import { BabyAttr } from "./Step3Attributes/BabyAttr"
import { SportingAttr } from "./Step3Attributes/SportingAttr"
import { GroceriesAttr } from "./Step3Attributes/GroceriesAttr"
import { OtherAttr } from "./Step3Attributes/OtherAttr"
// New
import { VehiclesAttr } from "./Step3Attributes/VehiclesAttr"
import { FurnitureAttr } from "./Step3Attributes/FurnitureAttr"
import { BuildingConstructionAttr } from "./Step3Attributes/BuildingConstructionAttr"
import { SolarEnergyAttr } from "./Step3Attributes/SolarEnergyAttr"
import { AgriculturalAttr } from "./Step3Attributes/AgriculturalAttr"
import { EventPartyAttr } from "./Step3Attributes/EventPartyAttr"
import { HeavyEquipmentAttr } from "./Step3Attributes/HeavyEquipmentAttr"
import { MusicalInstrumentsAttr } from "./Step3Attributes/MusicalInstrumentsAttr"
import { PetSuppliesAttr } from "./Step3Attributes/PetSuppliesAttr"
import { IndustrialAttr } from "./Step3Attributes/IndustrialAttr"
import { BooksEducationAttr } from "./Step3Attributes/BooksEducationAttr"
import { AutomotivePartsAttr } from "./Step3Attributes/AutomotivePartsAttr"
import { KidsToysAttr } from "./Step3Attributes/KidsToysAttr"

export function Step3Attributes({ categorySlug }: { categorySlug: string }) {
  const { control, formState: { errors } } = useFormContext()
  const props = { control, errors }

  switch (categorySlug) {
    // Existing
    case "phones-tablets":          return <PhonesAttr {...props} />
    case "computing":               return <ComputingAttr {...props} />
    case "electronics":             return <ElectronicsAttr {...props} />
    case "fashion":                 return <FashionAttr {...props} />
    case "home-office":             return <HomeOfficeAttr {...props} />
    case "health-beauty":           return <HealthBeautyAttr {...props} />
    case "baby-products":           return <BabyAttr {...props} />
    case "sporting-goods":          return <SportingAttr {...props} />
    case "groceries":               return <GroceriesAttr {...props} />
    case "other":                   return <OtherAttr {...props} />
    // New
    case "vehicles":                return <VehiclesAttr {...props} />
    case "furniture":               return <FurnitureAttr {...props} />
    case "building-construction":   return <BuildingConstructionAttr {...props} />
    case "solar-energy":            return <SolarEnergyAttr {...props} />
    case "agricultural-farming":    return <AgriculturalAttr {...props} />
    case "event-party":             return <EventPartyAttr {...props} />
    case "heavy-equipment-power":   return <HeavyEquipmentAttr {...props} />
    case "musical-instruments":     return <MusicalInstrumentsAttr {...props} />
    case "pet-supplies":            return <PetSuppliesAttr {...props} />
    case "industrial-manufacturing":return <IndustrialAttr {...props} />
    case "books-education":         return <BooksEducationAttr {...props} />
    case "automotive-parts":        return <AutomotivePartsAttr {...props} />
    case "kids-toys":               return <KidsToysAttr {...props} />
    default: return (
      <div className="p-6 border rounded-lg bg-muted/30 text-center text-muted-foreground">
        Select a category first to see relevant attributes.
      </div>
    )
  }
}
