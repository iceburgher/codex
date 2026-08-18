import {PropertyProject,ScenarioId,ScenarioResult,TaxConfig} from './types';
const n=(v:number|null|undefined)=>v??0;
export const stampDuty=(purchase:number,taxAssessment:number|null,rate:number,fee:number)=>Math.max(purchase,n(taxAssessment))*rate+fee;
export const mortgageDeed=(secured:number,existing:number|null,rate:number,fee:number)=>Math.max(0,secured-n(existing))*rate+(secured>n(existing)?fee:0);
export const vat=(gross:number,rate:number,deductible:number)=>{const included=gross-gross/(1+rate);return{included,deductible:included*deductible,cash:gross-included*deductible}};
export const rot=(labor:number,rate:number,...allowances:number[])=>Math.min(labor*rate,allowances.reduce((a,b)=>a+b,0));
export const dividendGrossUp=(net:number,rate:number)=>({gross:net/(1-rate),tax:net/(1-rate)-net});
export const salaryCost=(net:number,taxRate:number,employerRate:number)=>{const gross=net/(1-taxRate);return{gross,employerContribution:gross*employerRate,companyCost:gross*(1+employerRate)}};
export const loanInterest=(principal:number,rate:number,months:number,deduction:number)=>principal*rate*months/12*(1-deduction);
export const rentalTax=(gross:number,fraction:number,c:TaxConfig)=>Math.max(0,gross-c.rentalStandardDeduction*fraction-gross*c.rentalPercentDeduction)*c.capitalIncomeTaxRate;
export const annualizedRoi=(roi:number,months:number)=>1+roi<=0?null:Math.pow(1+roi,12/months)-1;
export function solveBreakEven(fn:(sale:number)=>number,target=0){let lo=0,hi=100_000_000;for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(fn(mid)<target)lo=mid;else hi=mid;if(hi-lo<=100)break}return Math.round((lo+hi)/2)}
const LABELS:Record<ScenarioId,string>={private_equity_funded:'Private · Equity',private_debt_funded:'Private · Debt',existing_company:'Existing AB',separate_project_company:'Project AB'};
export function calculateScenario(p:PropertyProject,id:ScenarioId,c:TaxConfig):ScenarioResult{
 const company=id==='existing_company'||id==='separate_project_company', debt=id==='private_debt_funded'?n(p.financing.privateMortgage)+n(p.financing.privateUnsecuredLoan):company?n(p.financing.companyExternalLoan)+(id==='separate_project_company'?n(p.financing.intercompanyLoan):0):0;
 const rate=company?c.companyStampDutyRate:c.privateStampDutyRate,purchase=n(p.inputs.purchasePrice),months=p.inputs.holdingPeriodMonths;
 const purchaseFees=stampDuty(purchase,p.inputs.priorYearTaxAssessmentValue,rate,c.titleRegistrationFee)+mortgageDeed(debt,p.inputs.existingMortgageDeeds,c.mortgageDeedTaxRate,c.mortgageDeedAdminFee);
 const rotValue=company?0:rot(n(p.renovation.rotEligibleLabor),c.rotRate,c.rotMaxPerPerson,c.rotMaxPerPerson);
 const renovationCost=company?vat(p.renovation.renovationBudgetGross,.25,p.renovation.vatDeductibilityRate).cash:p.renovation.renovationBudgetGross-rotValue;
 const financingCost=id==='private_debt_funded'?loanInterest(n(p.financing.privateMortgage),n(p.financing.privateMortgageRate),months,c.securedLoanInterestDeductionRate)+loanInterest(n(p.financing.privateUnsecuredLoan),n(p.financing.privateUnsecuredLoanRate),months,c.unsecuredLoanInterestDeductionRate):company?loanInterest(n(p.financing.companyExternalLoan),n(p.financing.companyLoanRate),months,0):0;
 const annual=Object.values(p.operatingCosts).reduce<number>((a,v)=>a+n(v),0),runningCosts=annual*months/12;
 const sale=n(p.sale.expectedSalePrice??p.inputs.expectedSalePrice), saleCosts=Object.entries(p.sale).filter(([k])=>!['expectedSalePrice','priceNegotiationBufferRate'].includes(k)).reduce<number>((a,[,v])=>a+n(v as number|null),0);
 const base=purchase+purchaseFees+renovationCost+financingCost+runningCosts+saleCosts, profitBeforeTax=sale? sale-base:null;
 let tax:number|null=null;if(profitBeforeTax!==null){if(company)tax=Math.max(0,profitBeforeTax)*c.corporateTaxRate;else if(p.taxOverrides.privateClassification==='private_residential_property')tax=Math.max(0,profitBeforeTax)*c.privateResidentialCapitalGainEffectiveRate;}
 const profitAfterTax=profitBeforeTax===null||tax===null?null:profitBeforeTax-tax, extraction=p.taxOverrides.dividendTaxRate;
 const retainedCompany=company?profitAfterTax:null,privateNet=company?(profitAfterTax===null||extraction===null?null:profitAfterTax*(1-extraction)):profitAfterTax;
 const equity=Math.max(0,base-debt),roi=privateNet===null||!equity?null:privateNet/equity;
 const warnings:string[]=[];if(!sale)warnings.push('Sale price is missing');if(!company&&p.taxOverrides.privateClassification==='unconfirmed')warnings.push('Private tax classification is unconfirmed');if(company&&p.ownership.privateUse!=='none')warnings.push('Private access may trigger benefit taxation');if(company&&p.renovation.vatDeductibilityRate>0)warnings.push('Residential VAT deduction requires advisor support');if(company&&extraction===null)warnings.push('Owner extraction tax is not entered');
 const breakEven=solveBreakEven(s=>s-base-(company?Math.max(0,s-base)*c.corporateTaxRate:p.taxOverrides.privateClassification==='private_residential_property'?Math.max(0,s-base)*c.privateResidentialCapitalGainEffectiveRate:0));
 return{id,label:LABELS[id],totalCapital:base,equity,debt,purchaseFees,renovationCost,financingCost,runningCosts,saleCosts,profitBeforeTax,tax,profitAfterTax,privateNet,retainedCompany,equityRoi:roi,annualizedRoi:roi===null?null:annualizedRoi(roi,months),breakEven,familyNetWorth:privateNet,peakCash:equity,warnings};
}
export const calculateAll=(p:PropertyProject,c:TaxConfig)=>p.ownership.compareScenarios.map(id=>calculateScenario(p,id,c));
