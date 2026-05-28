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

export function Step3Attributes({ categorySlug }: { categorySlug: string }) {
  const { control, formState: { errors } } = useFormContext()
  const props = { control, errors }

  switch (categorySlug) {
    case "phones-tablets": return <PhonesAttr {...props} />
    case "computing":      return <ComputingAttr {...props} />
    case "electronics":    return <ElectronicsAttr {...props} />
    case "fashion":        return <FashionAttr {...props} />
    case "home-office":    return <HomeOfficeAttr {...props} />
    case "health-beauty":  return <HealthBeautyAttr {...props} />
    case "baby-products":  return <BabyAttr {...props} />
    case "sporting-goods": return <SportingAttr {...props} />
    case "groceries":      return <GroceriesAttr {...props} />
    case "other":          return <OtherAttr {...props} />
    default: return (
      <div className="p-6 border rounded-lg bg-muted/30 text-center text-muted-foreground">
        Select a category first to see relevant attributes.
      </div>
    )
  }
}
