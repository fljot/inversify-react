import * as React from 'react';
import { useContext, useState } from 'react';
import { interfaces } from 'inversify';
import { InversifyReactContext } from './internal/utils';

const providerErrors = {
	// TODO:#review: extended error text: DX is everything
	onContainerPropUpdate: `Swapping container is not supported.
Maybe you're rendering Provider in some list?
Try adding \`key={container.guid}\` (inversify 4.x) / \`key={container.id}\` (inversify 5.x) to the \`Provider\`.
More info: 
https://reactjs.org/docs/lists-and-keys.html#keys,
https://reactjs.org/docs/reconciliation.html#recursing-on-children
`,
	// TODO:#review: if agree, how to update message? encourage feedback from other users?
	onStandalonePropChange: 'Changing `standalone` prop is not supported. Does it make any sense to change it?',
	onSelfParentContainer: `Parent container (resolved from React Context) is same as container specified in props.
Did you mean to configure Provider as \`standalone={true}\`?
`,
	onAmbiguousHierarchy: `Ambiguous containers hierarchy.
Container already has a parent, but not configured as standalone,
and now inversify-react has found a potential parent container on React Context.
Did you mean to configure Provider as \`standalone={true}\`?
Or check why container has already parent and if you should unset it?
`,
};

type ProviderProps = Readonly<{
	container: interfaces.Container;
	standalone?: boolean;
}>;

const Provider: React.FC<ProviderProps> = ({ children, container, standalone = false }) => {

	// #DX: guard against `container` prop change and warn with explicit error
	const [initialContainer] = useState(container);
	if (container !== initialContainer) {
		throw new Error(providerErrors.onContainerPropUpdate);
	}

	// #DX: guard against `standalone` prop change and warn with explicit error
	const [initialStandalone] = useState(standalone);
	if (standalone !== initialStandalone) {
		throw new Error(providerErrors.onStandalonePropChange);
	}

	// we bind our container to parent container before first render,
	// so that children would be able to resolve stuff from parent containers
	const parentContainer = useContext(InversifyReactContext);
	useState(function prepareContainer() { // gets called only once before very first render for side-effect
		if (!standalone && parentContainer) {
			if (parentContainer === container) {
				throw new Error(providerErrors.onSelfParentContainer);
			}
			if (container.parent) {
				throw new Error(providerErrors.onAmbiguousHierarchy);
			}

			container.parent = parentContainer;
		}
	});

	return (
		<InversifyReactContext.Provider value={container}>
			{/*TODO:#review: motivation for previous React.Children.only?*/}
			{children}
		</InversifyReactContext.Provider>
	);
};

export { ProviderProps, Provider };
export default Provider;
