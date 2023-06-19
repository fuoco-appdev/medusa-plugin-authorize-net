import {
  AbstractPaymentProcessor,
  PaymentProcessorContext,
  PaymentProcessorError,
  PaymentProcessorSessionResponse,
  PaymentSessionStatus,
} from "@medusajs/medusa";

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
    throw new Error("Method not implemented.");
  }
  public async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented.");
  }
  public async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {
    const { customer, paymentSessionData } = context;

    if (!customer?.metadata?.authorize_net_id) {
      try {
        await this.createCustomerProfileAsync(context);
      } catch (error: any) {
        throw error;
      }
    }

    return {
      session_data: paymentSessionData,
      update_requests: customer?.metadata?.authorize_net_id
        ? undefined
        : {
            customer_metadata: {
              authorize_net_id: customer.id,
            },
          },
    };
  }
  public async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented.");
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
    throw new Error("Method not implemented.");
  }
  public async updatePayment(
    context: PaymentProcessorContext
  ): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
    throw new Error("Method not implemented.");
  }

  private async createCustomerProfileAsync(
    context: PaymentProcessorContext
  ): Promise<any> {
    const { customer, email } = context;

    const customerPaymentProfileType =
      new ApiContracts.CustomerPaymentProfileType();
    customerPaymentProfileType.setCustomerType(
      ApiContracts.CustomerTypeEnum.INDIVIDUAL
    );

    const paymentProfilesList = [];
    paymentProfilesList.push(customerPaymentProfileType);

    const customerAddress = new ApiContracts.CustomerAddressType();
    customerAddress.setFirstName(customer.billing_address.first_name);
    customerAddress.setLastName(customer.billing_address.last_name);
    customerAddress.setAddress(customer.billing_address.address_1);
    customerAddress.setCity(customer.billing_address.city);
    customerAddress.setState(customer.billing_address.province);
    customerAddress.setZip(customer.billing_address.postal_code);
    customerAddress.setCountry(customer.billing_address.country);
    customerAddress.setPhoneNumber(customer.billing_address.phone);

    const customerProfileType = new ApiContracts.CustomerProfileType();
    customerProfileType.setMerchantCustomerId(customer.id);
    customerProfileType.setEmail(email);
    customerProfileType.setPaymentProfiles(paymentProfilesList);
    customerProfileType.setBillTo(customerAddress);

    const createRequest = new ApiContracts.CreateCustomerProfileRequest();
    createRequest.setProfile(customerProfileType);
    createRequest.setValidationMode(ApiContracts.ValidationModeEnum.TESTMODE);
    createRequest.setMerchantAuthentication(this._merchantAuthenticationType);

    const ctrl = new ApiControllers.CreateCustomerProfileController(
      createRequest.getJSON()
    );

    return new Promise<any>((resolve, reject) => {
      ctrl.execute(() => {
        const apiResponse = ctrl.getResponse();
        const response = new ApiContracts.CreateCustomerProfileResponse(
          apiResponse
        );

        if (response === null) {
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
    });
  }
}

export default AuthorizeNetService;
