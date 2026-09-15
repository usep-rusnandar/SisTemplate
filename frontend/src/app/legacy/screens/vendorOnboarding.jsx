import React from "react";
import { BrandMasterProvider } from "../../../modules/vendor-onboarding/legacy/BrandMasterData.jsx";
import { KbliMasterProvider } from "../../../modules/vendor-onboarding/legacy/KbliMasterData.jsx";
import { CountryMasterProvider } from "../../../modules/vendor-onboarding/legacy/CountryMasterData.jsx";
import { ProvinceMasterProvider } from "../../../modules/vendor-onboarding/legacy/ProvinceMasterData.jsx";
import { CityMasterProvider } from "../../../modules/vendor-onboarding/legacy/CityMasterData.jsx";
import { DistrictMasterProvider } from "../../../modules/vendor-onboarding/legacy/DistrictMasterData.jsx";
import { VillageMasterProvider } from "../../../modules/vendor-onboarding/legacy/VillageMasterData.jsx";
import { SpecialReqMasterProvider } from "../../../modules/vendor-onboarding/legacy/SpecialReqMasterData.jsx";
import { CommodityMasterProvider } from "../../../modules/vendor-onboarding/legacy/CommodityMasterData.jsx";
import { VendorMasterProvider } from "../../../modules/vendor-onboarding/legacy/VendorMasterData.jsx";
import { VendorRegistry, VendorApprovalQueue } from "../../../modules/vendor-onboarding/legacy/VendorScreen.jsx";
import { VendorInvitation } from "../../../modules/vendor-onboarding/legacy/ScreensVendorMore.jsx";
import { VendorAribaImport } from "../../../modules/vendor-onboarding/legacy/VendorAribaImport.jsx";
import { VendorRelationshipMaster, VendorDocRequirementMaster } from "../../../modules/vendor-onboarding/legacy/ScreensVendorMaster.jsx";
import { BrandMasterData } from "../../../modules/vendor-onboarding/legacy/ScreensBrandMaster.jsx";
import { KbliMasterData } from "../../../modules/vendor-onboarding/legacy/ScreensKbliMaster.jsx";
import { CountryMasterData } from "../../../modules/vendor-onboarding/legacy/ScreensCountryMaster.jsx";
import { AdminRegionsMasterData } from "../../../modules/vendor-onboarding/legacy/ScreensAdminRegions.jsx";
import { SpecialRequirementMasterData } from "../../../modules/vendor-onboarding/legacy/ScreensSpecialReqMaster.jsx";
import { CommodityMasterData } from "../../../modules/vendor-onboarding/legacy/ScreensCommodityMaster.jsx";
import { VendorStatusMaster, KbliTypeMaster, KbliStatusMaster } from "../../../modules/vendor-onboarding/legacy/MasterLookupEditor.jsx";

export function VendorOnboardingMasterDataProviders({ children }) {
  return (
    <VendorMasterProvider>
      <BrandMasterProvider>
        <KbliMasterProvider>
          <CountryMasterProvider>
            <ProvinceMasterProvider>
              <CityMasterProvider>
                <DistrictMasterProvider>
                  <VillageMasterProvider>
                    <SpecialReqMasterProvider>
                      <CommodityMasterProvider>
                        {children}
                      </CommodityMasterProvider>
                    </SpecialReqMasterProvider>
                  </VillageMasterProvider>
                </DistrictMasterProvider>
              </CityMasterProvider>
            </ProvinceMasterProvider>
          </CountryMasterProvider>
        </KbliMasterProvider>
      </BrandMasterProvider>
    </VendorMasterProvider>
  );
}

export function renderVendorOnboardingScreen(route) {
  if (route === "vendor") return <VendorRegistry />;
  if (route === "vendorApproval") return <VendorApprovalQueue />;
  if (route === "vendorInvitation") return <VendorInvitation />;
  if (route === "vendorImport") return <VendorAribaImport />;
  if (route === "vendorRelationship") return <VendorRelationshipMaster />;
  if (route === "vendorDocReq") return <VendorDocRequirementMaster />;
  if (route === "brand") return <BrandMasterData />;
  if (route === "kbli") return <KbliMasterData />;
  if (route === "country") return <CountryMasterData />;
  if (route === "adminRegions") return <AdminRegionsMasterData />;
  if (route === "specialRequirement") return <SpecialRequirementMasterData />;
  if (route === "commodity") return <CommodityMasterData />;
  if (route === "vendorStatus") return <VendorStatusMaster />;
  if (route === "kbliType") return <KbliTypeMaster />;
  if (route === "kbliStatus") return <KbliStatusMaster />;
  return null;
}
