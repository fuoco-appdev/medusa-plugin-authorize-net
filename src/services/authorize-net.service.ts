import {
  AbstractPaymentProcessor,
  PaymentProcessorContext,
  PaymentProcessorError,
  PaymentProcessorSessionResponse,
  PaymentSessionStatus,
} from "@medusajs/medusa";

export interface AuthorizeNetOptions {}

class AuthorizeNetService extends AbstractPaymentProcessor {
  public static identifier = "authorize-net";

  protected readonly _options: AuthorizeNetOptions;

  protected constructor(_, options) {
    super(_, options);

    this._options = options;
  }

  async capturePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented.");
  }
  async authorizePayment(
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
  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented.");
  }
  async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {
    throw new Error("Method not implemented.");
  }
  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented.");
  }
  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    throw new Error("Method not implemented.");
  }
  async refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented.");
  }
  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<Record<string, unknown> | PaymentProcessorError> {
    throw new Error("Method not implemented.");
  }
  async updatePayment(
    context: PaymentProcessorContext
  ): Promise<void | PaymentProcessorError | PaymentProcessorSessionResponse> {
    throw new Error("Method not implemented.");
  }
}

export default AuthorizeNetService;
