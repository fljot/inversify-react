import { ComponentClass, Component, createContext } from 'react';
import { interfaces, Container } from 'inversify';

type InversifyReactContextValue = interfaces.Container | undefined;
const InversifyReactContext = createContext<InversifyReactContextValue>(undefined);
InversifyReactContext.displayName = 'InversifyReactContext';

const AdministrationKey = "~$inversify-react"; // no ES6 WeakMap because we target ES5 to support more browsers
// TODO:#review: maybe `lib` in tsconfig + polyfill instead? would be nicer DX!.. it's almost 2020 :)

const requestScope: interfaces.BindingScope = 'Request'; // type-safe and explicit exclusion of one binding scope
// inversify-react does not support 'Request' binding scope, so here's explicit more narrow type
type ProvideBindingScope = Exclude<interfaces.BindingScope, typeof requestScope>;

interface ServiceDescriptor {
	scope: ProvideBindingScope;
	service: interfaces.ServiceIdentifier<unknown>;
}

interface DiClassAdministration {
	accepts: boolean;
	provides: boolean;

	services: ServiceDescriptor[];
}

interface DiInstanceAdministration {
	container: interfaces.Container;

	properties: { [key: string]: () => any };
	provides: boolean;
}

function getClassAdministration(target: any) {
	let administration: DiClassAdministration | undefined = target[AdministrationKey];

	if (!administration) {
		administration = {
			accepts: false,
			provides: false,
			services: [],
		};

		Object.defineProperty(target, AdministrationKey, {
			enumerable: false,
			writable: false,
			value: administration,
		});
	}

	return administration;
}

function getInstanceAdministration(target: any) {
	let administration: DiInstanceAdministration | undefined = target[AdministrationKey];

	if (!administration) {
		let classAdministration: DiClassAdministration = target.constructor[AdministrationKey];

		const parentContainer = target.context as InversifyReactContextValue;

		// we resolve container using 2 strategies:
		// either own container gets created for @provide-ed services,
		// or we find one on React context;
		// lazy container allows us to collect all @provide meta first, then bind all
		// TODO:#review: just to clarify: before `getInstanceAdministration` wasn't used in @provide,
		//  but only at the time of resolving;
		//  with new implementation @provide uses new prop `DiInstanceAdministration.provides`, so we defer container
		let container: interfaces.Container | undefined;
		const resolveContainer = (): interfaces.Container => container || (() => {
			if (classAdministration.provides) {
				container = new Container();

				for (const service of classAdministration.services) {
					const bindingInWhenOnSyntax = container.bind(service.service)
						.toSelf();

					switch (service.scope) {
						case 'Singleton':
							bindingInWhenOnSyntax.inSingletonScope();
							break;

						case 'Transient':
							bindingInWhenOnSyntax.inTransientScope();
							break;

						default:
							const exhaustive: never = service.scope;
							throw new Error(`Invalid service scope '${service.scope}'`);
					}
				}

				if (parentContainer) {
					container.parent = parentContainer;
				}
			} else {
				if (!parentContainer) {
					throw new Error('Cannot use resolve services without any providers in component tree.');
				}
				container = parentContainer;
			}
			return container;
		})();


		administration = {
			provides: false,
			get container(): interfaces.Container {
				return resolveContainer();
			},
			properties: {},
		};

		Object.defineProperty(target, AdministrationKey, {
			enumerable: false,
			writable: false,
			value: administration,
		});
	}

	return administration;
}

function ensureAcceptContext(target: ComponentClass) {
	const administration = getClassAdministration(target);

	if (administration.accepts) {
		// class already accepts react context
		return;
	}

	// TODO:#review: do we really need to guard it?
	//  do we need `DiClassAdministration.accepts` at all?
	target.contextType = InversifyReactContext;
	administration.accepts = true;
}

function getContainer(target: Component) {
	return getInstanceAdministration(target).container;
}

interface PropertyOptions {
	isOptional?: boolean;
	defaultValue?: any;
}

function createProperty(target: Component, name: string, type: interfaces.ServiceIdentifier<unknown>, options: PropertyOptions) {
	Object.defineProperty(target, name, {
		enumerable: true,
		get() {
			const administration = getInstanceAdministration(this);
			let getter = administration.properties[name];

			if (!getter) {
				const { container } = administration;

				let value: unknown;
				if (options.isOptional)
				{
					if (container.isBound(type)) {
						value = container.get(type);
					} else {
						value = options.defaultValue;
					}
				}
				else
				{
					value = container.get(type);
				}

				getter = administration.properties[name] = () => value;
			}

			return getter();
		}
	});

	const descriptor = Object.getOwnPropertyDescriptor(target, name);
	if (!descriptor)
		throw new Error('Failed to define property');

	return descriptor;
}

export {
	InversifyReactContext,
	AdministrationKey,
	ServiceDescriptor,
	ProvideBindingScope,
	DiClassAdministration, DiInstanceAdministration,
	ensureAcceptContext,
	getContainer, createProperty, PropertyOptions,
	getClassAdministration, getInstanceAdministration,
};
