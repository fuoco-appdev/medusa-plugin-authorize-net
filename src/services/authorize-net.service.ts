import {
  AbstractPaymentProcessor,
  PaymentProcessorContext,
  PaymentProcessorError,
  PaymentProcessorSessionResponse,
  PaymentSessionStatus,
} from "@medusajs/medusa";
import * as crypto from "crypto";

const ApiContracts = require("authorizenet").APIContracts;
const ApiControllers = require("authorizenet").APIControllers;

export interface AuthorizeNetOptions {
  api_key: string;
  transaction_key: string;
}

class AuthorizeNetService extends AbstractPaymentProcessor {
  public static identifier = "authorize-net";

  protected readonly _options: AuthorizeNetOptions;

  // @ts-ignore
  private readonly _merchantAuthenticationType: ApiContracts.MerchantAuthenticationType;

  protected constructor(_, options) {
    super(_, options);

    this._options = options;

    this._merchantAuthenticationType =
      new ApiContracts.MerchantAuthenticationType();
    this._merchantAuthenticationType.setName(this._options.api_key);
    this._merchantAuthenticationType.setTransactionKey(
      this._options.transaction_key
    );
  }

  public async capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented.");
  }
  public async authorizePayment(
    paymentSessionData: Record<string, unknown>,
    context: Record<string, unknown>
  ): Promise<
    | PaymentProcessorError
    | {
        status: PaymentSessionStatus;
        data: Record<string, unknown>;
      }
  > {
    console.log(context);
    return {
      status: PaymentSessionStatus.AUTHORIZED,
      data: {},
    };
  }
  public async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented.");
  }
  public async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {
    const { customer } = context;

    const opaqueValue = this.generateNonce();
    try {
      const customerProfileId = customer?.metadata?.authorize_net_id as string;
      let profileResponse = undefined;
      if (!customer?.metadata?.authorize_net_id) {
        profileResponse = await this.createCustomerProfileAsync(
          opaqueValue,
          context
        );
      } else {
        profileResponse = await this.getCustomerProfileAsync(customerProfileId);
      }

      let authorizeNetPaymentProfiles =
        (customer?.metadata?.authorize_net_payment_profiles as Record<
          string,
          string
        >) ?? {};
      const profile = (profileResponse?.profile as any) ?? {};
      const paymentProfiles = (profile?.paymentProfiles as object[]) ?? [];
      authorizeNetPaymentProfiles = this.updatePaymentProfileMetadata(
        customer.billing_address_id,
        authorizeNetPaymentProfiles,
        paymentProfiles
      );

      let data = undefined;
      if (!customer.billing_address_id) {
        data = paymentProfiles[0];
      } else {
        if (
          Object.keys(authorizeNetPaymentProfiles).includes(
            customer.billing_address_id
          )
        ) {
          const response = await this.getCustomerPaymentProfileAsync(
            profile?.customerProfileId ?? "",
            authorizeNetPaymentProfiles[customer.billing_address_id] ?? ""
          );
          data = response?.getJSON();
        } else {
          const response = await this.createCustomerPaymentProfileAsync(
            opaqueValue,
            profile?.customerProfileId,
            context
          );
          data = response?.getJSON();
          if (data.customerPaymentProfileId) {
            authorizeNetPaymentProfiles[customer.billing_address_id] =
              data.customerPaymentProfileId;
          }
        }
      }

      return {
        session_data: data,
        update_requests: {
          customer_metadata: {
            authorize_net_id: customer.id,
            authorize_net_opaque_value: opaqueValue,
            authorize_net_payment_profiles: authorizeNetPaymentProfiles,
          },
        },
      };
    } catch (error: any) {
      throw error;
    }
  }
  public async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    try {
      const profile =
        (paymentSessionData?.paymentProfile as Record<string, unknown>) ?? {};
      const customerProfileId = (profile?.customerProfileId as string) ?? "";
      const customerPaymentProfileId =
        (profile?.customerPaymentProfileId as string) ?? "";
      const response = await this.deleteCustomerPaymentProfileAsync(
        customerProfileId,
        customerPaymentProfileId
      );
      return {
        session_data: response?.getJSON(),
        update_requests: {
          customer_metadata: {
            authorize_net_opaque_value: undefined,
          },
        },
      };
    } catch (error: any) {
      throw error;
    }
  }
  public async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    throw new Error("Method not implemented.");
  }
  public async refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented.");
  }
  public async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    try {
      const profile =
        (paymentSessionData?.paymentProfile as Record<string, unknown>) ?? {};
      const customerProfileId = (profile?.customerProfileId as string) ?? "";
      const customerPaymentProfileId =
        (profile?.customerPaymentProfileId as string) ?? "";
      const response = await this.getCustomerPaymentProfileAsync(
        customerProfileId,
        customerPaymentProfileId
      );
      return response.getJSON();
    } catch (error: any) {
      throw error;
    }
  }

  public async updatePayment(
    context: PaymentProcessorContext
  ): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
    const { paymentSessionData, customer } = context;
    const profile =
      (paymentSessionData?.paymentProfile as Record<string, unknown>) ?? {};
    const customerProfileId = (profile?.customerProfileId as string) ?? "";
    const customerPaymentProfileId =
      (profile.customerPaymentProfileId as string) ?? "";
    try {
      const opaqueValue = this.generateNonce();
      const response = await this.updateCustomerPaymentProfileAsync(
        opaqueValue,
        customerProfileId,
        customerPaymentProfileId,
        context
      );

      let authorizeNetPaymentProfiles =
        (customer?.metadata?.authorize_net_payment_profiles as Record<
          string,
          string
        >) ?? {};
      if (
        customer.billing_address_id &&
        !Object.keys(authorizeNetPaymentProfiles).includes(
          customer.billing_address_id
        )
      ) {
        const customerPaymentProfileId = response.customerPaymentProfileId as
          | string
          | undefined;
        if (customerPaymentProfileId) {
          authorizeNetPaymentProfiles[customer.billing_address_id] =
            customerPaymentProfileId;
        }
      }

      return {
        session_data: response.getJSON(),
        update_requests: {
          customer_metadata: {
            authorize_net_opaque_value: opaqueValue,
            authorize_net_payment_profiles: authorizeNetPaymentProfiles,
          },
        },
      };
    } catch (error: any) {
      throw error;
    }
  }

  private async deleteCustomerPaymentProfileAsync(
    customerProfileId: string,
    customerPaymentProfileId: string
    //@ts-ignore
  ): Promise<ApiContracts.DeleteCustomerPaymentProfileRequest> {
    const deleteRequest =
      new ApiContracts.DeleteCustomerPaymentProfileRequest();
    deleteRequest.setMerchantAuthentication(this._merchantAuthenticationType);
    deleteRequest.setCustomerProfileId(customerProfileId);
    deleteRequest.setCustomerPaymentProfileId(customerPaymentProfileId);

    const ctrl = new ApiControllers.DeleteCustomerPaymentProfileController(
      deleteRequest.getJSON()
    );

    //@ts-ignore
    return new Promise<ApiContracts.DeleteCustomerPaymentProfileRequest>(
      (resolve, reject) => {
        ctrl.execute(() => {
          const apiResponse = ctrl.getResponse();
          const response =
            new ApiContracts.DeleteCustomerPaymentProfileResponse(apiResponse);

          if (!response) {
            reject(new Error("Null response received"));
          }

          if (
            !response.getMessages().getResultCode() !==
            ApiContracts.MessageTypeEnum.OK
          ) {
            reject(new Error(response.getMessages()));
          }

          resolve(response);
        });
      }
    );
  }

  private async createCustomerPaymentProfileAsync(
    opaqueValue: string,
    customerProfileId: string,
    context: PaymentProcessorContext
    //@ts-ignore
  ): Promise<ApiContracts.CreateCustomerPaymentProfileResponse> {
    const { customer } = context;

    const opaqueData = new ApiContracts.OpaqueDataType();
    opaqueData.setDataDescriptor("COMMON.ACCEPT.INAPP.PAYMENT");
    opaqueData.setDataValue(opaqueValue);

    const paymentType = new ApiContracts.PaymentType();
    paymentType.setOpaqueData(opaqueData);

    const customerAddressType = new ApiContracts.CustomerAddressType();
    if (customer.billing_address) {
      const {
        first_name,
        last_name,
        address_1,
        city,
        province,
        postal_code,
        country,
        phone,
      } = customer.billing_address;
      customerAddressType.setFirstName(first_name);
      customerAddressType.setLastName(last_name);
      customerAddressType.setAddress(address_1);
      customerAddressType.setCity(city);
      customerAddressType.setState(province);
      customerAddressType.setZip(postal_code);
      customerAddressType.setCountry(country);
      customerAddressType.setPhoneNumber(phone);
    }

    const paymentProfile = new ApiContracts.CustomerPaymentProfileType();
    paymentProfile.setBillTo(customerAddressType);
    paymentProfile.setPayment(paymentType);

    const createRequest =
      new ApiContracts.CreateCustomerPaymentProfileRequest();
    createRequest.setMerchantAuthentication(this._merchantAuthenticationType);
    createRequest.setCustomerProfileId(customerProfileId);
    createRequest.setPaymentProfile(paymentProfile);

    const ctrl = new ApiControllers.CreateCustomerPaymentProfileController(
      createRequest.getJSON()
    );

    //@ts-ignore
    return new Promise<ApiContracts.CreateCustomerPaymentProfileResponse>(
      (resolve, reject) => {
        ctrl.execute(() => {
          const apiResponse = ctrl.getResponse();

          const response =
            new ApiContracts.CreateCustomerPaymentProfileResponse(apiResponse);

          if (!response) {
            reject(new Error("Null response received"));
          }

          if (
            response.getMessages().getResultCode() !==
            ApiContracts.MessageTypeEnum.OK
          ) {
            reject(new Error(response.getMessages()));
          }

          resolve(response);
        });
      }
    );
  }

  private async getCustomerPaymentProfileAsync(
    customerProfileId: string,
    customerPaymentProfileId: string
    //@ts-ignore
  ): Promise<ApiContracts.GetCustomerPaymentProfileResponse> {
    const getRequest = new ApiContracts.GetCustomerPaymentProfileRequest();
    getRequest.setMerchantAuthentication(this._merchantAuthenticationType);
    getRequest.setCustomerProfileId(customerProfileId);
    getRequest.setCustomerPaymentProfileId(customerPaymentProfileId);

    const ctrl = new ApiControllers.GetCustomerProfileController(
      getRequest.getJSON()
    );
    //@ts-ignore
    return new Promise<ApiContracts.GetCustomerPaymentProfileResponse>(
      (resolve, reject) => {
        ctrl.execute(() => {
          const apiResponse = ctrl.getResponse();
          const response = new ApiContracts.GetCustomerPaymentProfileResponse(
            apiResponse
          );

          if (!response) {
            reject(new Error("Null response received"));
          }

          if (
            response.getMessages().getResultCode() !==
            ApiContracts.MessageTypeEnum.OK
          ) {
            reject(new Error(response.getMessages()));
          }

          resolve(response);
        });
      }
    );
  }

  private async updateCustomerPaymentProfileAsync(
    opaqueValue: string,
    customerProfileId: string,
    customerPaymentProfileId: string,
    context: PaymentProcessorContext
    //@ts-ignore
  ): Promise<ApiContracts.UpdateCustomerPaymentProfileResponse> {
    const { customer } = context;

    const customerAddressType = new ApiContracts.CustomerAddressType();
    if (customer.billing_address) {
      const {
        first_name,
        last_name,
        address_1,
        city,
        province,
        postal_code,
        country,
        phone,
      } = customer.billing_address;
      customerAddressType.setFirstName(first_name);
      customerAddressType.setLastName(last_name);
      customerAddressType.setAddress(address_1);
      customerAddressType.setCity(city);
      customerAddressType.setState(province);
      customerAddressType.setZip(postal_code);
      customerAddressType.setCountry(country);
      customerAddressType.setPhoneNumber(phone);
    }

    const opaqueData = new ApiContracts.OpaqueDataType();
    opaqueData.setDataDescriptor("COMMON.ACCEPT.INAPP.PAYMENT");
    opaqueData.setDataValue(opaqueValue);

    const paymentType = new ApiContracts.PaymentType();
    paymentType.setOpaqueData(opaqueData);

    const customerForUpdate = new ApiContracts.CustomerPaymentProfileExType();
    customerForUpdate.setPayment(paymentType);
    customerForUpdate.setCustomerPaymentProfileId(customerPaymentProfileId);
    customerForUpdate.setBillTo(customerAddressType);

    const updateRequest =
      new ApiContracts.UpdateCustomerPaymentProfileRequest();
    updateRequest.setMerchantAuthentication(this._merchantAuthenticationType);
    updateRequest.setCustomerProfileId(customerProfileId);
    updateRequest.setPaymentProfile(customerForUpdate);
    updateRequest.setValidationMode(ApiContracts.ValidationModeEnum.LIVEMODE);

    const ctrl = new ApiControllers.UpdateCustomerPaymentProfileController(
      updateRequest.getJSON()
    );
    //@ts-ignore
    return new Promise<ApiContracts.UpdateCustomerPaymentProfileResponse>(
      (resolve, reject) => {
        ctrl.execute(() => {
          const apiResponse = ctrl.getResponse();
          const response =
            new ApiContracts.UpdateCustomerPaymentProfileResponse(apiResponse);

          if (!response) {
            reject(new Error("Null response received"));
          }

          if (
            response.getMessages().getResultCode() !==
            ApiContracts.MessageTypeEnum.OK
          ) {
            reject(new Error(response.getMessages()));
          }

          resolve(response);
        });
      }
    );
  }

  private async getCustomerProfileAsync(
    customerId: string
    //@ts-ignore
  ): Promise<ApiContracts.GetCustomerProfileResponse> {
    const getRequest = new ApiContracts.GetCustomerProfileRequest();
    getRequest.setCustomerProfileId(customerId);
    getRequest.setMerchantAuthentication(this._merchantAuthenticationType);

    const ctrl = new ApiControllers.GetCustomerProfileController(
      getRequest.getJSON()
    );
    //@ts-ignore
    return new Promise<ApiContracts.GetCustomerProfileResponse>(
      (resolve, reject) => {
        ctrl.execute(() => {
          const apiResponse = ctrl.getResponse();
          const response = new ApiContracts.GetCustomerProfileResponse(
            apiResponse
          );

          if (!response) {
            reject(new Error("Null response received"));
          }

          if (
            response.getMessages().getResultCode() !==
            ApiContracts.MessageTypeEnum.OK
          ) {
            reject(new Error(response.getMessages()));
          }

          resolve(response);
        });
      }
    );
  }

  private async createCustomerProfileAsync(
    opaqueValue: string,
    context: PaymentProcessorContext
    //@ts-ignore
  ): Promise<ApiContracts.CreateCustomerProfileResponse> {
    const { customer, email } = context;

    const opaqueData = new ApiContracts.OpaqueDataType();
    opaqueData.setDataDescriptor("COMMON.ACCEPT.INAPP.PAYMENT");
    opaqueData.setDataValue(opaqueValue);

    const paymentType = new ApiContracts.PaymentType();
    paymentType.setOpaqueData(opaqueData);

    const customerAddress = new ApiContracts.CustomerAddressType();
    if (customer.billing_address) {
      const {
        first_name,
        last_name,
        address_1,
        city,
        province,
        postal_code,
        country,
        phone,
      } = customer.billing_address;
      customerAddress.setFirstName(first_name);
      customerAddress.setLastName(last_name);
      customerAddress.setAddress(address_1);
      customerAddress.setCity(city);
      customerAddress.setState(province);
      customerAddress.setZip(postal_code);
      customerAddress.setCountry(country);
      customerAddress.setPhoneNumber(phone);
    }

    const customerPaymentProfileType =
      new ApiContracts.CustomerPaymentProfileType();
    customerPaymentProfileType.setCustomerType(
      ApiContracts.CustomerTypeEnum.INDIVIDUAL
    );
    customerPaymentProfileType.setPayment(paymentType);
    customerPaymentProfileType.setBillTo(customerAddress);

    const paymentProfilesList = [];
    paymentProfilesList.push(customerPaymentProfileType);

    const customerProfileType = new ApiContracts.CustomerProfileType();
    customerProfileType.setMerchantCustomerId(customer?.id);
    customerProfileType.setEmail(email);
    customerProfileType.setPaymentProfiles(paymentProfilesList);

    const createRequest = new ApiContracts.CreateCustomerProfileRequest();
    createRequest.setProfile(customerProfileType);
    createRequest.setValidationMode(ApiContracts.ValidationModeEnum.TESTMODE);
    createRequest.setMerchantAuthentication(this._merchantAuthenticationType);

    const ctrl = new ApiControllers.CreateCustomerProfileController(
      createRequest.getJSON()
    );

    //@ts-ignore
    return new Promise<ApiContracts.CreateCustomerProfileResponse>(
      (resolve, reject) => {
        ctrl.execute(() => {
          const apiResponse = ctrl.getResponse();
          const response = new ApiContracts.CreateCustomerProfileResponse(
            apiResponse
          );

          if (!response) {
            reject(new Error("Null response received"));
          }

          if (
            response.getMessages().getResultCode() !==
            ApiContracts.MessageTypeEnum.OK
          ) {
            reject(new Error(response.getMessages()));
          }

          resolve(response);
        });
      }
    );
  }

  private generateNonce(): string {
    const crypto = require("crypto");
    return crypto.randomBytes(16).toString("base64");
  }

  private updatePaymentProfileMetadata(
    billingAddressId: string | undefined,
    paymentProfilesMetadata: Record<string, string>,
    paymentProfiles: object[]
  ): Record<string, string> {
    if (billingAddressId) {
      const newPaymentProfile = paymentProfiles.find(
        (value) =>
          !Object.values(paymentProfilesMetadata).includes(
            value["customerPaymentProfileId"]
          )
      );
      if (newPaymentProfile) {
        const paymentProfileId = newPaymentProfile["customerPaymentProfileId"];
        if (paymentProfileId) {
          paymentProfilesMetadata[billingAddressId] = paymentProfileId;
        }
      }
    }

    return paymentProfilesMetadata;
  }
}

export default AuthorizeNetService;
