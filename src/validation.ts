import Ajv from "ajv";
import {ValidationError} from "./types";

function isEmail(email: string): boolean {
    const re = /^(?=[a-z0-9][a-z0-9@._%+-]{5,253}$)[a-z0-9._%+-]{1,64}@(?:[a-z0-9-]{1,63}\.){1,8}[a-z]{2,63}$/;
    return re.test(email.toLowerCase());
}

export class Validator {
    private ajv: Ajv;

    private static validateUuid(schema: boolean, data: string): boolean {
        if (schema) {
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
            return uuidPattern.test(data);
        }
        return true;
    }

    private static validateJson(schema: boolean, data: string): boolean {
        if (schema && data) {
            try {
                JSON.parse(data);
                return true;
            } catch (e) {
                return false;
            }
        }
        return true;
    }

    private static validateEmail(schema: boolean, data: string): boolean {
        if (schema && data) {
            return isEmail(data);
        }
        return true;
    }

    private static validateDate(schema: boolean, data: string): boolean {
        if (schema) {
            return /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(data);
        }
        return true;
    }

    private static validateTime(schema: boolean, data: string): boolean {
        if (schema) {
            return /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?$/.test(data);
        }
        return true;
    }

    private static validateDatetime(schema: boolean | string, data: string): boolean {
        if (schema) {
            const zuluPattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?Z$/;
            if (schema === "zulu") {
                return zuluPattern.test(data);
            }
            const fullPattern = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
            return fullPattern.test(data);
        }
        return true;
    }

    constructor() {
        this.ajv = new Ajv();
        this.ajv.addKeyword({
            keyword: "uuid",
            type: "string",
            schemaType: "boolean",
            validate: Validator.validateUuid
        });
        this.ajv.addKeyword({
            keyword: "json",
            type: "string",
            schemaType: "boolean",
            validate: Validator.validateJson
        });
        this.ajv.addKeyword({
            keyword: "email",
            type: "string",
            schemaType: "boolean",
            validate: Validator.validateEmail
        });
        this.ajv.addKeyword({
            keyword: "date",
            type: "string",
            schemaType: "boolean",
            validate: Validator.validateDate
        });
        this.ajv.addKeyword({
            keyword: "time",
            type: "string",
            schemaType: "boolean",
            validate: Validator.validateTime
        });
        this.ajv.addKeyword({
            keyword: "datetime",
            type: "string",
            schemaType: ["boolean", "string"],
            validate: Validator.validateDatetime
        });
    }

    public validate<T>(schema: object, data: T): T {
        const isValid = this.ajv.validate(schema, data);
        if (!isValid) {
            const errorMessages = this.ajv.errorsText();
            throw new ValidationError(`Validation Error: ${errorMessages}`);
        }

        return data;
    }

    public validateUuid(uuid: string) {
        if (!Validator.validateUuid(true, uuid)) {
            throw new ValidationError(`Invalid UUID: ${uuid}`);
        }
    }

}

export const validator = new Validator();
